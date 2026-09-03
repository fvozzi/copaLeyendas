import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { type AuthenticatedUser } from '../auth/current-user.decorator';
import { UserRole } from '../auth/user.entity';
import { CourtAssistantAssignment } from '../courts/court-assistant-assignment.entity';
import { Court } from '../courts/court.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { RegistrationStatus } from '../registrations/registration.enums';
import { MatchStatus, ParticipantSource } from './tournament.enums';
import { TournamentCategory } from './tournament-category.entity';
import { TournamentMatch } from './tournament-match.entity';
import { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import { Tournament } from './tournament.entity';
import { ZoneEntry } from './zone-entry.entity';
import { Zone } from './zone.entity';

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament) private t: Repository<Tournament>,
    @InjectRepository(TournamentCategory) private tc: Repository<TournamentCategory>,
    @InjectRepository(Zone) private z: Repository<Zone>,
    @InjectRepository(ZoneEntry) private e: Repository<ZoneEntry>,
    @InjectRepository(TournamentMatch) private m: Repository<TournamentMatch>,
    @InjectRepository(TournamentScheduleSlot) private slots: Repository<TournamentScheduleSlot>,
    @InjectRepository(Court) private c: Repository<Court>,
    @InjectRepository(CourtAssistantAssignment) private assignments: Repository<CourtAssistantAssignment>,
    @InjectRepository(PairRegistration) private r: Repository<PairRegistration>,
  ) {}

  list() { return this.t.find({ order: { startsAt: 'DESC', id: 'DESC' } }); }
  create(dto: Partial<Tournament>) { return this.t.save(this.t.create(dto)); }
  async update(id: number, dto: Partial<Tournament>) {
    const tournament = await this.t.findOneBy({ id });
    if (!tournament) throw new NotFoundException('Torneo no encontrado');
    if (dto.name !== undefined) tournament.name = dto.name.trim();
    if (dto.startsAt !== undefined) tournament.startsAt = dto.startsAt || null;
    if (dto.endsAt !== undefined) tournament.endsAt = dto.endsAt || null;
    if (dto.city !== undefined) tournament.city = dto.city?.trim() || null;
    if (dto.status !== undefined) tournament.status = dto.status;
    return this.t.save(tournament);
  }
  async addCategory(tournamentId: number, dto: Partial<TournamentCategory>) { return this.tc.save(this.tc.create({ ...dto, tournamentId, pointsPerSet: dto.pointsPerSet ?? 25, setsToWin: dto.setsToWin ?? 1, zoneSize: dto.zoneSize ?? 4, registrationsOpen: dto.registrationsOpen ?? true })); }
  async updateCategory(id: number, dto: { pointsPerSet?: number; setsToWin?: number; zoneSize?: number; registrationsOpen?: boolean }) {
    const category = await this.tc.findOneBy({ id });
    if (!category) throw new NotFoundException('Categoria de torneo no encontrada');
    if (dto.pointsPerSet !== undefined) category.pointsPerSet = dto.pointsPerSet;
    if (dto.setsToWin !== undefined) category.setsToWin = dto.setsToWin;
    if (dto.zoneSize !== undefined) category.zoneSize = dto.zoneSize;
    if (dto.registrationsOpen !== undefined) category.registrationsOpen = dto.registrationsOpen;
    return this.tc.save(category);
  }
  async createZone(dto: { tournamentCategoryId: number; courtId: number; name: string; capacity: number }) { if (!(await this.c.findOneBy({ id: dto.courtId }))) throw new NotFoundException('Cancha no encontrada'); return this.z.save(this.z.create(dto)); }
  async updateZone(id: number, dto: { name?: string; courtId?: number; capacity?: number }) {
    const zone = await this.z.findOneBy({ id });
    if (!zone) throw new NotFoundException('Zona no encontrada');
    if (dto.courtId !== undefined) { if (!(await this.c.findOneBy({ id: dto.courtId }))) throw new NotFoundException('Cancha no encontrada'); zone.courtId = dto.courtId; }
    if (dto.capacity !== undefined) { if (dto.capacity < await this.e.countBy({ zoneId: id })) throw new BadRequestException('El cupo no puede ser menor a las parejas ya asignadas'); zone.capacity = dto.capacity; }
    if (dto.name !== undefined) zone.name = dto.name.trim();
    return this.z.save(zone);
  }
  async addEntry(zoneId: number, registrationId: number) { const zone = await this.z.findOneBy({ id: zoneId }); if (!zone) throw new NotFoundException('Zona no encontrada'); if (await this.e.countBy({ zoneId }) >= zone.capacity) throw new BadRequestException('La zona alcanzo su cupo'); return this.e.save(this.e.create({ zoneId, registrationId })); }

  async divideZones(tournamentCategoryId: number) {
    const category = await this.tc.findOne({ where: { id: tournamentCategoryId }, relations: { category: true } });
    if (!category) throw new NotFoundException('Categoria de torneo no encontrada');
    const existing = await this.z.find({ where: { tournamentCategoryId } });
    if (existing.length && await this.e.count({ where: existing.map((zone) => ({ zoneId: zone.id })) })) throw new BadRequestException('No se pueden redistribuir zonas que ya tienen parejas asignadas.');
    if (existing.length) await this.z.remove(existing);
    const registrations = await this.r.find({ where: { category: category.category.code, status: RegistrationStatus.CONFIRMED }, order: { localityName: 'ASC', id: 'ASC' } });
    const count = Math.max(1, Math.ceil(registrations.length / category.zoneSize));
    const courts = await this.c.find({ where: { active: true }, order: { name: 'ASC' } });
    if (!courts.length) throw new BadRequestException('Debes habilitar al menos una cancha antes de dividir las zonas.');
    const zones = await this.z.save(Array.from({ length: count }, (_, index) => this.z.create({ tournamentCategoryId, courtId: courts[index % courts.length].id, name: `Zona ${String.fromCharCode(65 + index)}`, capacity: category.zoneSize })));
    const assignments = zones.map((zone) => ({ zone, entries: [] as PairRegistration[] }));
    for (const registration of registrations) {
      const eligible = assignments.filter((item) => item.entries.length < category.zoneSize && !item.entries.some((entry) => entry.localityName.trim().toLowerCase() === registration.localityName.trim().toLowerCase()));
      const target = (eligible.length ? eligible : assignments.filter((item) => item.entries.length < category.zoneSize)).sort((a, b) => a.entries.length - b.entries.length)[0];
      target.entries.push(registration);
      await this.e.save(this.e.create({ zoneId: target.zone.id, registrationId: registration.id, seed: target.entries.length }));
    }
    return this.z.find({ where: { tournamentCategoryId }, order: { name: 'ASC' } });
  }

  async scheduleGrid(tournamentId: number) {
    const categories = await this.tc.find({ where: { tournamentId }, relations: { category: true }, order: { id: 'ASC' } });
    let sequence = (await this.slots.maximum('sequence', { tournamentId })) ?? 0;
    for (const category of categories) {
      if (await this.slots.exist({ where: { tournamentCategoryId: category.id } })) continue;
      for (let matchOrder = 1; matchOrder <= 4; matchOrder += 1) for (let zone = 0; zone < 4; zone += 1) {
        sequence += 1;
        await this.slots.save(this.slots.create({ tournamentId, tournamentCategoryId: category.id, zoneName: `Zona ${String.fromCharCode(65 + zone)}`, matchOrder, sequence, scheduledAt: null }));
      }
    }
    const [slots, zones] = await Promise.all([this.slots.find({ where: { tournamentId }, relations: { tournamentCategory: { category: true } }, order: { sequence: 'ASC' } }), this.z.find({ where: { tournamentCategory: { tournamentId } }, relations: { court: true } })]);
    return slots.map((slot) => ({ ...slot, court: zones.find((zone) => zone.tournamentCategoryId === slot.tournamentCategoryId && zone.name === slot.zoneName)?.court ?? null }));
  }

  async updateScheduleSlot(id: number, dto: { scheduledAt?: string | null }) {
    const slot = await this.slots.findOneBy({ id }); if (!slot) throw new NotFoundException('Turno no encontrado');
    if (dto.scheduledAt !== undefined) slot.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    await this.slots.save(slot);
    const zone = await this.z.findOneBy({ tournamentCategoryId: slot.tournamentCategoryId, name: slot.zoneName });
    if (zone) await this.m.update({ zoneId: zone.id, matchOrder: slot.matchOrder }, { scheduledAt: slot.scheduledAt });
    return slot;
  }

  async fixture(zoneId: number) {
    const [entries, zone] = await Promise.all([this.e.find({ where: { zoneId }, order: { seed: 'ASC', id: 'ASC' } }), this.z.findOneBy({ id: zoneId })]);
    if (!zone) throw new NotFoundException('Zona no encontrada');
    if (![3, 4].includes(entries.length)) throw new BadRequestException('La zona debe tener 3 o 4 parejas');
    await this.m.delete({ zoneId });
    const planned = await this.slots.find({ where: { tournamentCategoryId: zone.tournamentCategoryId, zoneName: zone.name } });
    const direct = (a: number, b: number, order: number) => { const slot = planned.find((item) => item.matchOrder === order); return this.m.save(this.m.create({ zoneId, matchOrder: order, homeRegistrationId: a, awayRegistrationId: b, scheduledAt: slot?.scheduledAt ?? null, status: MatchStatus.READY })); };
    const p1 = await direct(entries[0].registrationId, entries[1].registrationId, 1);
    if (entries.length === 3) { await direct(entries[0].registrationId, entries[2].registrationId, 2); await direct(entries[1].registrationId, entries[2].registrationId, 3); return this.matches(zoneId); }
    const p2 = await direct(entries[2].registrationId, entries[3].registrationId, 2);
    const thirdSlot = planned.find((item) => item.matchOrder === 3);
    const fourthSlot = planned.find((item) => item.matchOrder === 4);
    await this.m.save(this.m.create({ zoneId, matchOrder: 3, scheduledAt: thirdSlot?.scheduledAt ?? null, homeSource: ParticipantSource.WINNER, homeSourceMatchId: p1.id, awaySource: ParticipantSource.LOSER, awaySourceMatchId: p2.id, status: MatchStatus.PENDING }));
    await this.m.save(this.m.create({ zoneId, matchOrder: 4, scheduledAt: fourthSlot?.scheduledAt ?? null, homeSource: ParticipantSource.WINNER, homeSourceMatchId: p2.id, awaySource: ParticipantSource.LOSER, awaySourceMatchId: p1.id, status: MatchStatus.PENDING }));
    return this.matches(zoneId);
  }

  async schedule(id: number, scheduledAt: string, user: AuthenticatedUser) {
    const match = await this.matchWithZone(id);
    await this.assertCourtAccess(user, match.zone.courtId);
    match.scheduledAt = new Date(scheduledAt);
    return this.m.save(match);
  }

  async result(id: number, homeScore: number, awayScore: number, user: AuthenticatedUser) {
    if (homeScore === awayScore) throw new BadRequestException('El partido debe tener ganador');
    const match = await this.matchWithZone(id);
    await this.assertCourtAccess(user, match.zone.courtId);
    if (!match.homeRegistrationId || !match.awayRegistrationId) throw new BadRequestException('El partido no esta listo');
    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.winnerRegistrationId = homeScore > awayScore ? match.homeRegistrationId : match.awayRegistrationId;
    match.status = MatchStatus.PLAYED;
    await this.m.save(match);
    await this.resolveDependents(match);
    return match;
  }

  async assertZoneAccess(user: AuthenticatedUser, zoneId: number) {
    const zone = await this.z.findOneBy({ id: zoneId });
    if (!zone) throw new NotFoundException('Zona no encontrada');
    await this.assertCourtAccess(user, zone.courtId);
  }

  matches(zoneId: number) { return this.m.find({ where: { zoneId }, relations: { homeRegistration: true, awayRegistration: true }, order: { matchOrder: 'ASC' } }); }

  private async matchWithZone(id: number) {
    const match = await this.m.findOne({ where: { id }, relations: { zone: true } });
    if (!match) throw new NotFoundException('Partido no encontrado');
    return match;
  }

  private async assertCourtAccess(user: AuthenticatedUser, courtId: number) {
    if (user.role === UserRole.DIRECTOR) return;
    if (user.role === UserRole.ASSISTANT && await this.assignments.existsBy({ courtId, userId: user.sub })) return;
    throw new ForbiddenException('No tenes acceso a esta cancha.');
  }

  private async resolveDependents(source: TournamentMatch) {
    const matches = await this.m.find({ where: [{ homeSourceMatchId: source.id }, { awaySourceMatchId: source.id }] });
    for (const match of matches) {
      const fill = async (side: 'home' | 'away') => {
        const sourceId = side === 'home' ? match.homeSourceMatchId : match.awaySourceMatchId;
        if (sourceId !== source.id) return;
        const sourceType = side === 'home' ? match.homeSource : match.awaySource;
        const loser = source.homeRegistrationId === source.winnerRegistrationId ? source.awayRegistrationId : source.homeRegistrationId;
        if (side === 'home') match.homeRegistrationId = sourceType === ParticipantSource.WINNER ? source.winnerRegistrationId : loser;
        else match.awayRegistrationId = sourceType === ParticipantSource.WINNER ? source.winnerRegistrationId : loser;
      };
      await fill('home');
      await fill('away');
      if (match.homeRegistrationId && match.awayRegistrationId) match.status = MatchStatus.READY;
      await this.m.save(match);
    }
  }
}
