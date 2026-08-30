import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ContentPost } from './content-post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(ContentPost)
    private readonly postsRepository: Repository<ContentPost>,
  ) {}

  async list(query: QueryPostsDto, options?: { publicOnly?: boolean }) {
    const where: Record<string, unknown> = {};

    if (query.section) {
      where.section = query.section;
    }

    if (typeof query.featured === 'boolean') {
      where.featured = query.featured;
    }

    if (typeof query.published === 'boolean') {
      where.published = query.published;
    }

    if (options?.publicOnly) {
      where.published = true;
    }

    if (query.search?.trim()) {
      return this.postsRepository.find({
        where: [
          {
            ...where,
            title: ILike(`%${query.search.trim()}%`),
          },
          {
            ...where,
            excerpt: ILike(`%${query.search.trim()}%`),
          },
        ],
        order: {
          featured: 'DESC',
          sortOrder: 'ASC',
          publishedAt: 'DESC',
          createdAt: 'DESC',
        },
      });
    }

    return this.postsRepository.find({
      where,
      order: {
        featured: 'DESC',
        sortOrder: 'ASC',
        publishedAt: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async getPublicBySlug(slug: string) {
    const post = await this.postsRepository.findOne({
      where: {
        slug,
        published: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async getById(id: number) {
    const post = await this.postsRepository.findOne({ where: { id } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async create(dto: CreatePostDto) {
    const slug = await this.ensureUniqueSlug(dto.slug ?? dto.title);
    const post = this.postsRepository.create({
      ...dto,
      slug,
      coverImageUrl: dto.coverImageUrl?.trim() || null,
      published: dto.published ?? false,
      featured: dto.featured ?? false,
      sortOrder: dto.sortOrder ?? 0,
      publishedAt: dto.published ? new Date() : null,
    });

    return this.postsRepository.save(post);
  }

  async update(id: number, dto: UpdatePostDto) {
    const post = await this.getById(id);

    if (dto.title && !dto.slug) {
      post.slug = await this.ensureUniqueSlug(dto.title, id);
    }

    if (dto.slug) {
      post.slug = await this.ensureUniqueSlug(dto.slug, id);
    }

    Object.assign(post, {
      ...dto,
      coverImageUrl:
        dto.coverImageUrl === undefined ? post.coverImageUrl : dto.coverImageUrl.trim() || null,
    });

    if (dto.published === true && !post.publishedAt) {
      post.publishedAt = new Date();
    }

    if (dto.published === false) {
      post.publishedAt = null;
    }

    return this.postsRepository.save(post);
  }

  async remove(id: number) {
    const post = await this.getById(id);
    await this.postsRepository.remove(post);
    return { success: true };
  }

  private async ensureUniqueSlug(input: string, currentId?: number) {
    const baseSlug = slugify(input);
    let candidate = baseSlug;
    let counter = 2;

    while (true) {
      const existing = await this.postsRepository.findOne({ where: { slug: candidate } });

      if (!existing || existing.id === currentId) {
        return candidate;
      }

      candidate = `${baseSlug}-${counter}`;
      counter += 1;
    }
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}
