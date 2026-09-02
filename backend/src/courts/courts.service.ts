import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { User, UserRole } from '../auth/user.entity';
import { CourtAssistantAssignment } from './court-assistant-assignment.entity';
import { Court } from './court.entity';

export interface CourtInput { name: string; address?: string; city?: string; provinceName?: string; active?: boolean; }

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court) private readonly repository: Repository<Court>,
    @InjectRepository(CourtAssistantAssignment) private readonly assignments: Repository<CourtAssistantAssignment>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(search?: string) {
    const qb = this.repository.createQueryBuilder('court');
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.where(new Brackets((inner) => inner.where('LOWER(court.name) LIKE :term', { term }).orWhere("LOWER(COALESCE(court.city, '')) LIKE :term", { term }).orWhere("LOWER(COALESCE(court.provinceName, '')) LIKE :term", { term })));
    }
    return this.serializeMany(await qb.orderBy('court.name', 'ASC').getMany());
  }

  async getById(id: number) {
    const item = await this.repository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Cancha no encontrada');
    return item;
  }

  async create(input: CourtInput) {
    const court = await this.repository.save(this.repository.create({ name: input.name.trim(), address: optional(input.address), city: optional(input.city), provinceName: optional(input.provinceName), active: input.active ?? true }));
    return this.serialize(court);
  }

  async update(id: number, input: Partial<CourtInput>) {
    const item = await this.getById(id);
    if (input.name !== undefined) item.name = input.name.trim();
    if (input.address !== undefined) item.address = optional(input.address);
    if (input.city !== undefined) item.city = optional(input.city);
    if (input.provinceName !== undefined) item.provinceName = optional(input.provinceName);
    if (input.active !== undefined) item.active = input.active;
    return this.serialize(await this.repository.save(item));
  }

  async setAssistants(courtId: number, userIds: number[]) {
    await this.getById(courtId);
    const ids = [...new Set(userIds)];
    const users = ids.length ? await this.users.findBy({ id: In(ids) }) : [];
    if (users.length !== ids.length || users.some((user) => user.role !== UserRole.ASSISTANT)) {
      throw new BadRequestException('Solo se pueden asignar usuarios Encargado / Asistente.');
    }
    await this.assignments.manager.transaction(async (manager) => {
      await manager.delete(CourtAssistantAssignment, { courtId });
      if (ids.length) await manager.insert(CourtAssistantAssignment, ids.map((userId) => ({ courtId, userId })));
    });
    return this.serialize(await this.getById(courtId));
  }

  async isAssistantAssigned(courtId: number, userId: number) { return this.assignments.existsBy({ courtId, userId }); }

  async remove(id: number) {
    await this.repository.remove(await this.getById(id));
    return { success: true };
  }

  private async serializeMany(courts: Court[]) {
    const courtIds = courts.map((court) => court.id);
    const assignments = courtIds.length ? await this.assignments.find({ where: { courtId: In(courtIds) }, relations: { user: true } }) : [];
    return Promise.all(courts.map((court) => this.serialize(court, assignments.filter((assignment) => assignment.courtId === court.id))));
  }

  private async serialize(court: Court, knownAssignments?: CourtAssistantAssignment[]): Promise<Record<string, unknown>> {
    const assignments = knownAssignments ?? await this.assignments.find({ where: { courtId: court.id }, relations: { user: true } });
    return { ...court, assistantIds: assignments.map((assignment) => assignment.userId), assistants: assignments.map((assignment) => ({ id: assignment.user.id, name: assignment.user.name, email: assignment.user.email })) };
  }
}

function optional(value?: string | null) { const result = value?.trim(); return result || null; }
