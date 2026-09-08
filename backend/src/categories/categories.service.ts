import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';

export interface CategoryInput { name: string; active?: boolean; sortOrder?: number; }

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private readonly repository: Repository<Category>) {}
  async list() { return this.repository.find({ order: { sortOrder: 'ASC', name: 'ASC' } }); }
  async getById(id: number) { const item = await this.repository.findOne({ where: { id } }); if (!item) throw new NotFoundException('Categoria no encontrada'); return item; }
  async create(input: CategoryInput) { const item = this.repository.create({ ...input, name: input.name.trim(), active: input.active ?? true, sortOrder: input.sortOrder ?? 0 }); return this.repository.save(item); }
  async update(id: number, input: Partial<CategoryInput>) { const item = await this.getById(id); Object.assign(item, { ...input, name: input.name === undefined ? item.name : input.name.trim() }); return this.repository.save(item); }
  async remove(id: number) { await this.repository.remove(await this.getById(id)); return { success: true }; }
}
