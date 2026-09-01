import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { QueryLocalitiesDto } from './dto/query-localities.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';
import { Locality } from './locality.entity';
import { Category } from '../categories/category.entity';

@Injectable()
export class LocalitiesService {
  constructor(
    @InjectRepository(Locality)
    private readonly localitiesRepository: Repository<Locality>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async list(query: QueryLocalitiesDto) {
    const qb = this.localitiesRepository.createQueryBuilder('locality');

    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((inner) => {
          inner
            .where('LOWER(locality.name) LIKE :term', { term })
            .orWhere('LOWER(locality.provinceName) LIKE :term', { term });
        }),
      );
    }

    return qb.leftJoinAndSelect('locality.category', 'category').orderBy('locality.name', 'ASC').addOrderBy('locality.provinceName', 'ASC').getMany();
  }

  async getById(id: number) {
    const locality = await this.localitiesRepository.findOne({ where: { id }, relations: { category: true } });
    if (!locality) {
      throw new NotFoundException('Localidad no encontrada');
    }
    return locality;
  }

  async create(dto: CreateLocalityDto) {
    const categoryId = await this.resolveCategory(dto.categoryId);
    return this.localitiesRepository.save(
      this.localitiesRepository.create({
        name: dto.name.trim(),
        provinceName: dto.provinceName.trim(),
        active: dto.active ?? true,
        categoryId,
      }),
    );
  }

  async update(id: number, dto: UpdateLocalityDto) {
    const locality = await this.getById(id);
    if (dto.name !== undefined) locality.name = dto.name.trim();
    if (dto.provinceName !== undefined) locality.provinceName = dto.provinceName.trim();
    if (dto.active !== undefined) locality.active = dto.active;
    if (dto.categoryId !== undefined) locality.categoryId = await this.resolveCategory(dto.categoryId);
    return this.localitiesRepository.save(locality);
  }

  async remove(id: number) {
    const locality = await this.getById(id);
    await this.localitiesRepository.remove(locality);
    return { success: true };
  }

  private async resolveCategory(categoryId?: number | null) {
    if (!categoryId) return null;
    const category = await this.categoriesRepository.findOne({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Categoria no encontrada');
    return category.id;
  }
}
