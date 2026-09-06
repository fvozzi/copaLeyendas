import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { type AuthenticatedUser } from '../auth/current-user.decorator';
import { UserRole } from '../auth/user.entity';
import { CourtAssistantAssignment } from '../courts/court-assistant-assignment.entity';
import { Court } from '../courts/court.entity';
import { Venue } from '../courts/venue.entity';
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
    @InjectRepository(Venue) private venues: Repository<Venue>,
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
    if (dto.playingDays !== undefined) tournament.playingDays = [...new Set(dto.playingDays)].sort();
    if (dto.city !== undefined) tournament.city = dto.city?.trim() || null;
    if (dto.feePerPlayer !== undefined) tournament.feePerPlayer = dto.feePerPlayer;
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
  async createZone(dto: { tournamentCategoryId: number; venueId: number; name: string; capacity: number }) { if (!(await this.venues.findOneBy({ id: dto.venueId }))) throw new NotFoundException('Sede no encontrada'); return this.z.save(this.z.create(dto)); }
  async updateZone(id: number, dto: { name?: string; venueId?: number; capacity?: number }) {
    const zone = await this.z.findOneBy({ id });
    if (!zone) throw new NotFoundException('Zona no encontrada');
    if (dto.venueId !== undefined) { if (!(await this.venues.findOneBy({ id: dto.venueId }))) throw new NotFoundException('Sede no encontrada'); zone.venueId = dto.venueId; }
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
    const venues = await this.venues.find({ where: { active: true }, order: { name: 'ASC' } });
    if (!venues.length) throw new BadRequestException('Debes habilitar al menos una sede antes de dividir las zonas.');
    const zones = await this.z.save(Array.from({ length: count }, (_, index) => this.z.create({ tournamentCategoryId, venueId: venues[index % venues.length].id, name: `Zona ${String.fromCharCode(65 + index)}`, capacity: category.zoneSize })));
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
    const tournament = await this.t.findOneBy({ id: tournamentId });
    if (!tournament) throw new NotFoundException('Torneo no encontrado');
    const [zones, courts] = await Promise.all([this.z.find({ where: { tournamentCategory: { tournamentId } }, relations: { venue: true, tournamentCategory: true }, order: { tournamentCategoryId: 'ASC', name: 'ASC' } }), this.c.find({ where: { active: true }, relations: { venue: true }, order: { id: 'ASC' } })]);
    const existing = await this.slots.find({ where: { tournamentId }, order: { sequence: 'ASC' } });
    const knockoutSlots = [...new Set(zones.map((zone) => zone.tournamentCategoryId))].reduce((total, categoryId) => total + (zones.filter((zone) => zone.tournamentCategoryId === categoryId).length >= 4 ? 7 : 0), 0);
    const requiredSlots = zones.length * 4 + knockoutSlots;
    const stageOrder = { ZONE: 0, QUARTERFINAL: 1, SEMIFINAL: 2, FINAL: 3 } as Record<string, number>;
    const phasesAreOrdered = existing.every((slot, index) => index === 0 || (stageOrder[slot.stage] ?? -1) >= (stageOrder[existing[index - 1].stage] ?? -1));
    const mustGenerate = requiredSlots > 0 && (existing.length !== requiredSlots || existing.every((slot) => !slot.scheduledAt) || !phasesAreOrdered);
    if (mustGenerate) {
      await this.slots.delete({ tournamentId });
      const days = this.programDays(tournament);
      const venueQueues = new Map<number, { zone: Zone; nextOrder: number }[]>();
      for (const zone of zones) venueQueues.set(zone.venueId, [...(venueQueues.get(zone.venueId) ?? []), { zone, nextOrder: 1 }]);
      const venueIds = [...venueQueues.keys()].sort((left, right) => left - right);
      const venueCounts = new Map<number, number>();
      const defaultCourts = new Map<number, Court | undefined>();
      for (const venue of [...new Set(zones.map((zone) => zone.venueId))]) defaultCourts.set(venue, courts.find((court) => court.venueId === venue));
      const generated: TournamentScheduleSlot[] = [];
      let sequence = 0;
      while ([...venueQueues.values()].some((queue) => queue.some((item) => item.nextOrder <= 4))) {
        for (const venueId of venueIds) {
          const queue = venueQueues.get(venueId)!;
          const next = queue.find((item) => item.nextOrder <= 4);
          if (!next) continue;
          const venueIndex = venueCounts.get(venueId) ?? 0;
          venueCounts.set(venueId, venueIndex + 1);
          sequence += 1;
          generated.push(this.slots.create({ tournamentId, tournamentCategoryId: next.zone.tournamentCategoryId, zoneName: next.zone.name, matchOrder: next.nextOrder, stage: 'ZONE', sequence, courtId: defaultCourts.get(next.zone.venueId)?.id ?? null, scheduledAt: this.programDate(days, next.zone.venue.startsAt, next.zone.venue.matchDurationMinutes, next.zone.venue.matchesPerDay, venueIndex) }));
          next.nextOrder += 1;
          queue.push(queue.shift()!);
        }
      }
      const knockoutCategories = [...new Set(zones.map((zone) => zone.tournamentCategoryId))].map((categoryId) => ({ categoryId, zones: zones.filter((zone) => zone.tournamentCategoryId === categoryId) })).filter((item) => item.zones.length >= 4);
      const knockoutStages = [{ stage: 'QUARTERFINAL', label: 'Cuartos de final', matches: 4 }, { stage: 'SEMIFINAL', label: 'Semifinal', matches: 2 }, { stage: 'FINAL', label: 'Final', matches: 1 }] as const;
      for (const knockoutStage of knockoutStages) for (const category of knockoutCategories) for (let matchOrder = 1; matchOrder <= knockoutStage.matches; matchOrder += 1) {
        const venue = category.zones[0].venue;
        const venueIndex = venueCounts.get(venue.id) ?? 0;
        venueCounts.set(venue.id, venueIndex + 1);
        sequence += 1;
        generated.push(this.slots.create({ tournamentId, tournamentCategoryId: category.categoryId, zoneName: knockoutStage.label, matchOrder, stage: knockoutStage.stage, sequence, courtId: defaultCourts.get(venue.id)?.id ?? null, scheduledAt: this.programDate(days, venue.startsAt, venue.matchDurationMinutes, venue.matchesPerDay, venueIndex) }));
      }
      await this.slots.save(generated);
    }
    return this.slots.find({ where: { tournamentId }, relations: { court: { venue: true }, tournamentCategory: { category: true } }, order: { sequence: 'ASC' } });
  }

  private programDays(tournament: Tournament) {
    if (tournament.playingDays.length) return [...tournament.playingDays].sort();
    if (!tournament.startsAt) return [];
    const days = [tournament.startsAt];
    if (!tournament.endsAt) return days;
    for (let day = new Date(`${tournament.startsAt}T00:00:00Z`), end = new Date(`${tournament.endsAt}T00:00:00Z`); day < end;) { day.setUTCDate(day.getUTCDate() + 1); days.push(day.toISOString().slice(0, 10)); }
    return days;
  }

  private programDate(days: string[], startsAt: string, duration: number, matchesPerDay: number, index: number) {
    const day = days[Math.floor(index / matchesPerDay)];
    if (!day) return null;
    const [hour, minute] = startsAt.slice(0, 5).split(':').map(Number);
    const totalMinutes = hour * 60 + minute + (index % matchesPerDay) * duration;
    const date = new Date(`${day}T00:00:00-03:00`);
    date.setUTCHours(Math.floor(totalMinutes / 60) + 3, totalMinutes % 60, 0, 0);
    return date;
  }

  async updateScheduleSlot(id: number, dto: { scheduledAt?: string | null; courtId?: number | null }) {
    const slot = await this.slots.findOneBy({ id }); if (!slot) throw new NotFoundException('Turno no encontrado');
    if (dto.scheduledAt !== undefined) slot.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (dto.courtId !== undefined) { if (dto.courtId === null) slot.courtId = null; else { if (!(await this.c.findOneBy({ id: dto.courtId }))) throw new NotFoundException('Cancha no encontrada'); slot.courtId = dto.courtId; } }
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
    this.assertDirectorAccess(user);
    match.scheduledAt = new Date(scheduledAt);
    return this.m.save(match);
  }

  async result(id: number, homeScore: number, awayScore: number, user: AuthenticatedUser) {
    if (homeScore === awayScore) throw new BadRequestException('El partido debe tener ganador');
    const match = await this.matchWithZone(id);
    this.assertDirectorAccess(user);
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
    this.assertDirectorAccess(user);
  }

  matches(zoneId: number) { return this.m.find({ where: { zoneId }, relations: { homeRegistration: true, awayRegistration: true }, order: { matchOrder: 'ASC' } }); }

  private async matchWithZone(id: number) {
    const match = await this.m.findOne({ where: { id }, relations: { zone: true } });
    if (!match) throw new NotFoundException('Partido no encontrado');
    return match;
  }

  private assertDirectorAccess(user: AuthenticatedUser) {
    if (user.role === UserRole.DIRECTOR) return;
    throw new ForbiddenException('La asignacion de canchas se define al programar los partidos.');
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
