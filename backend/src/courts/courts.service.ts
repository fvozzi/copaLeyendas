import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { User, UserRole } from '../auth/user.entity';
import { CourtAssistantAssignment } from './court-assistant-assignment.entity';
import { Court } from './court.entity';
import { Venue } from './venue.entity';

export interface CourtInput { name: string; venueId: number; active?: boolean; }
export interface VenueInput { name: string; address?: string; city?: string; provinceName?: string; startsAt?: string; matchDurationMinutes?: number; matchesPerDay?: number; active?: boolean; }

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court) private readonly repository: Repository<Court>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(CourtAssistantAssignment) private readonly assignments: Repository<CourtAssistantAssignment>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(search?: string) {
    const qb = this.repository.createQueryBuilder('court');
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.where(new Brackets((inner) => inner.where('LOWER(court.name) LIKE :term', { term }).orWhere("LOWER(COALESCE(court.city, '')) LIKE :term", { term }).orWhere("LOWER(COALESCE(court.provinceName, '')) LIKE :term", { term })));
    }
    return this.serializeMany(await qb.leftJoinAndSelect('court.venue', 'venue').orderBy('venue.name', 'ASC').addOrderBy('court.name', 'ASC').getMany());
  }

  async getById(id: number) {
    const item = await this.repository.findOne({ where: { id }, relations: { venue: true } });
    if (!item) throw new NotFoundException('Cancha no encontrada');
    return item;
  }

  async create(input: CourtInput) {
    await this.getVenue(input.venueId); const court = await this.repository.save(this.repository.create({ name: input.name.trim(), venueId: input.venueId, active: input.active ?? true }));
    return this.serialize(court);
  }

  async update(id: number, input: Partial<CourtInput>) {
    const item = await this.getById(id);
    if (input.name !== undefined) item.name = input.name.trim();
    if (input.venueId !== undefined) { await this.getVenue(input.venueId); item.venueId = input.venueId; }
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
  listVenues() { return this.venues.find({ order: { name: 'ASC' } }); }
  async createVenue(input: VenueInput) { this.validateVenueSchedule(input); return this.venues.save(this.venues.create({ name: input.name.trim(), address: optional(input.address), city: optional(input.city), provinceName: optional(input.provinceName), startsAt: input.startsAt || '10:00', matchDurationMinutes: input.matchDurationMinutes ?? 40, matchesPerDay: input.matchesPerDay ?? 16, active: input.active ?? true })); }
  async updateVenue(id: number, input: Partial<VenueInput>) { const venue = await this.getVenue(id); this.validateVenueSchedule(input); if (input.name !== undefined) venue.name = input.name.trim(); if (input.address !== undefined) venue.address = optional(input.address); if (input.city !== undefined) venue.city = optional(input.city); if (input.provinceName !== undefined) venue.provinceName = optional(input.provinceName); if (input.startsAt !== undefined) venue.startsAt = input.startsAt; if (input.matchDurationMinutes !== undefined) venue.matchDurationMinutes = input.matchDurationMinutes; if (input.matchesPerDay !== undefined) venue.matchesPerDay = input.matchesPerDay; if (input.active !== undefined) venue.active = input.active; return this.venues.save(venue); }
  async removeVenue(id: number) { if (await this.repository.existsBy({ venueId: id })) throw new BadRequestException('No se puede eliminar una sede con canchas cargadas'); await this.venues.remove(await this.getVenue(id)); return { success: true }; }
  private async getVenue(id: number) { const venue = await this.venues.findOneBy({ id }); if (!venue) throw new NotFoundException('Sede no encontrada'); return venue; }
  private validateVenueSchedule(input: Partial<VenueInput>) { if (input.startsAt !== undefined && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(input.startsAt)) throw new BadRequestException('El horario de inicio no es valido.'); if (input.matchDurationMinutes !== undefined && (!Number.isInteger(input.matchDurationMinutes) || input.matchDurationMinutes < 1 || input.matchDurationMinutes > 240)) throw new BadRequestException('La duracion debe estar entre 1 y 240 minutos.'); if (input.matchesPerDay !== undefined && (!Number.isInteger(input.matchesPerDay) || input.matchesPerDay < 1 || input.matchesPerDay > 200)) throw new BadRequestException('La cantidad de partidos debe estar entre 1 y 200.'); }

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
