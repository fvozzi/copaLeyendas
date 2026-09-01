import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PairCategory } from '../registrations/registration.enums';
import { Category } from './category.entity';

export interface CategoryInput { code: PairCategory; name: string; active?: boolean; sortOrder?: number; }

const defaults: CategoryInput[] = [
  { code: PairCategory.DAMAS_A, name: 'Damas A', sortOrder: 10 },
  { code: PairCategory.DAMAS_B, name: 'Damas B', sortOrder: 20 },
  { code: PairCategory.DAMAS_NUCLEO_A, name: 'Damas Nucleo A', sortOrder: 30 },
  { code: PairCategory.DAMAS_NUCLEO_B, name: 'Damas Nucleo B', sortOrder: 40 },
];

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private readonly repository: Repository<Category>) {}
  async list() { await this.ensureDefaults(); return this.repository.find({ order: { sortOrder: 'ASC', name: 'ASC' } }); }
  async getById(id: number) { const item = await this.repository.findOne({ where: { id } }); if (!item) throw new NotFoundException('Categoria no encontrada'); return item; }
  async create(input: CategoryInput) { const item = this.repository.create({ ...input, name: input.name.trim(), active: input.active ?? true, sortOrder: input.sortOrder ?? 0 }); return this.repository.save(item); }
  async update(id: number, input: Partial<CategoryInput>) { const item = await this.getById(id); Object.assign(item, { ...input, name: input.name === undefined ? item.name : input.name.trim() }); return this.repository.save(item); }
  async remove(id: number) { await this.repository.remove(await this.getById(id)); return { success: true }; }
  private async ensureDefaults() { for (const item of defaults) { if (!(await this.repository.findOne({ where: { code: item.code } }))) await this.create(item); } }
}
