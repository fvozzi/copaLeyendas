import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { QueryLocalitiesDto } from './dto/query-localities.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';
import { Locality } from './locality.entity';
import { Category } from '../categories/category.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';

@Injectable()
export class LocalitiesService {
  constructor(
    @InjectRepository(Locality)
    private readonly localitiesRepository: Repository<Locality>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(RegistrationAccessGrant)
    private readonly accessGrantsRepository: Repository<RegistrationAccessGrant>,
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
    const name = dto.name !== undefined ? dto.name.trim() : locality.name;
    const provinceName = dto.provinceName !== undefined ? dto.provinceName.trim() : locality.provinceName;
    const categoryId = dto.categoryId !== undefined ? await this.resolveCategory(dto.categoryId) : locality.categoryId;
    const nextIdentity = [normalizeName(name), normalizeName(provinceName), categoryId];
    if (JSON.stringify(previousIdentity) !== JSON.stringify(nextIdentity)) {
      await this.ensureUnique(name, provinceName, categoryId, id);
    }
    await this.localitiesRepository.manager.transaction(async (manager) => {
      // Older grants stored the team name but never saved the locality ID.
      const sameIdentity = (await manager.find(Locality, { where: { categoryId: locality.categoryId ?? IsNull() } }))
        .filter((item) => normalizeName(item.name) === normalizeName(locality.name)
          && normalizeName(item.provinceName) === normalizeName(locality.provinceName));
      if (sameIdentity.length === 1) {
        await manager.update(RegistrationAccessGrant, {
          localityId: IsNull(), categoryId: locality.categoryId ?? IsNull(),
          localityName: locality.name, provinceName: locality.provinceName,
        }, { localityId: id });
      }
      const grants = await manager.find(RegistrationAccessGrant, { where: { localityId: id }, select: { id: true } });
      if (categoryId !== locality.categoryId && grants.length) {
        throw new BadRequestException('Este equipo tiene habilitaciones o inscripciones. No se puede cambiar su categoria.');
      }
      await manager.update(Locality, id, { name, provinceName, categoryId, active: dto.active ?? locality.active });
      if (name !== locality.name || provinceName !== locality.provinceName) {
        await manager.update(RegistrationAccessGrant, { localityId: id }, { localityName: name, provinceName });
        if (grants.length) {
          await manager.update(PairRegistration, { accessGrantId: In(grants.map((grant) => grant.id)) }, { localityName: name, provinceName });
        }
      }
    });
    return this.getById(id);
  }

  async remove(id: number) {
    const locality = await this.getById(id);
    const grants = await this.accessGrantsRepository.count({ where: [
      { localityId: id },
      { localityId: IsNull(), localityName: locality.name, provinceName: locality.provinceName, categoryId: locality.categoryId ?? IsNull() },
    ] });
    if (grants) {
      throw new BadRequestException('Este equipo tiene habilitaciones o inscripciones. Eliminalas primero en Inscripciones, o desactiva el equipo.');
    }
    const result = await this.localitiesRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Localidad no encontrada');
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
