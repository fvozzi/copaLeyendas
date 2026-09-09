import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
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
    await this.ensureUnique(dto.name, dto.provinceName, categoryId);
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
    const previousIdentity = [normalizeName(locality.name), normalizeName(locality.provinceName), locality.categoryId];
    if (dto.name !== undefined) locality.name = dto.name.trim();
    if (dto.provinceName !== undefined) locality.provinceName = dto.provinceName.trim();
    if (dto.active !== undefined) locality.active = dto.active;
    if (dto.categoryId !== undefined) locality.categoryId = await this.resolveCategory(dto.categoryId);
    const nextIdentity = [normalizeName(locality.name), normalizeName(locality.provinceName), locality.categoryId];
    if (JSON.stringify(previousIdentity) !== JSON.stringify(nextIdentity)) {
      await this.ensureUnique(locality.name, locality.provinceName, locality.categoryId, id);
    }
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

  private async ensureUnique(name: string, provinceName: string, categoryId: number | null, excludeId?: number) {
    const candidates = await this.localitiesRepository.find({ where: { categoryId: categoryId ?? IsNull() } });
    const duplicate = candidates.some((item) => item.id !== excludeId
      && normalizeName(item.name) === normalizeName(name)
      && normalizeName(item.provinceName) === normalizeName(provinceName));
    if (duplicate) {
      throw new ConflictException('Ya existe un equipo con esa localidad, provincia y categoria. Seleccionalo en la lista de equipos existentes.');
    }
  }
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
