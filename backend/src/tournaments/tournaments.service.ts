import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, MoreThanOrEqual, Repository } from 'typeorm';
import { type AuthenticatedUser } from '../auth/current-user.decorator';
import { UserRole } from '../auth/user.entity';
import { VenueLeaderAssignment } from '../courts/venue-leader-assignment.entity';
import { Court } from '../courts/court.entity';
import { Venue } from '../courts/venue.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { HeardAboutSource, RegistrationAccessGrantStatus, RegistrationStatus } from '../registrations/registration.enums';
import { Locality } from '../localities/locality.entity';
import { Player } from '../players/player.entity';
import { MatchStatus, ParticipantSource, TournamentStatus } from './tournament.enums';
import { TournamentCategory } from './tournament-category.entity';
import { TournamentMatch } from './tournament-match.entity';
import { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import { Tournament } from './tournament.entity';
import { ZoneEntry } from './zone-entry.entity';
import { Zone } from './zone.entity';
import { distributeProgramCourts, redistributeExistingCourts } from './program-courts';
import { matchView, programRelations, programView } from './program-view';
import { standings } from './zone-standings';
import { createHash, randomBytes } from 'node:crypto';
import type { ProgramScenarioDto } from './program-scenario.dto';
import { simulateProgram } from './program-scenario';
import { readMatchResultPhoto, removeMatchResultPhoto, storeMatchPhotoBuffer } from './match-result-photo-storage';
import { planTournamentDistribution, type DistributionRegistration } from './tournament-distribution';
import { TournamentRegistrationAttendance } from './tournament-registration-attendance.entity';
import { TournamentZoneVenuePlan } from './tournament-zone-venue-plan.entity';
import { preservedProgramAssignments } from './distribution-program';
import { inferredKnockoutStage, zoneMatchDefinitions, ZoneMethodology, type ZoneParticipantDefinition } from './tournament-methodology';
import { normalizeMatchPhoto, renderMatchResultCard } from './match-result-card';

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
    @InjectRepository(VenueLeaderAssignment) private assignments: Repository<VenueLeaderAssignment>,
    @InjectRepository(PairRegistration) private r: Repository<PairRegistration>,
  ) {}

  list() { return this.t.find({ order: { startsAt: 'DESC', id: 'DESC' } }); }
  async operations(user: AuthenticatedUser) {
    const tournament = await this.t.findOne({ where: { status: TournamentStatus.ACTIVE }, order: { startsAt: 'ASC', id: 'ASC' } });
    if (!tournament) return { tournament: null, courts: [], slots: [] };
    const allSlots = await this.slots.find({ where: { tournamentId: tournament.id }, relations: programRelations, order: { sequence: 'ASC' } });
    const assignedVenueIds = user.role === UserRole.DIRECTOR
      ? [...new Set(allSlots.flatMap((slot) => slot.court?.venueId ? [slot.court.venueId] : []))]
      : (await this.assignments.find({ where: { userId: user.sub } })).map((assignment) => assignment.venueId);
    if (user.role !== UserRole.DIRECTOR && !this.isCourtLeader(user)) throw new ForbiddenException('Este perfil no puede operar canchas.');
    const allowed = new Set(assignedVenueIds);
    const visibleSlots = allSlots.filter((slot) => slot.matchId && slot.courtId && slot.court?.venueId && allowed.has(slot.court.venueId));
    const courtIds = [...new Set(visibleSlots.flatMap((slot) => slot.courtId ? [slot.courtId] : []))];
    const courts = courtIds.length ? await this.c.find({ where: { id: In(courtIds) }, relations: { venue: true }, order: { name: 'ASC' } }) : [];
    return {
      tournament: { id: tournament.id, name: tournament.name, startsAt: tournament.startsAt, endsAt: tournament.endsAt },
      courts,
      slots: programView(visibleSlots).map((slot) => {
        if (!slot.match) return slot;
        const { resultSourcePhotoStoredName, resultPhotoStoredName, resultPhotoOriginalName, resultPhotoMimeType, resultPhotoSize, ...match } = slot.match;
        return { ...slot, match: { ...match, resultSourcePhotoAvailable: Boolean(resultSourcePhotoStoredName), resultPhotoAvailable: Boolean(resultPhotoStoredName), resultPhotoOriginalName } };
      }),
    };
  }
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
  async addCategory(tournamentId: number, dto: Partial<TournamentCategory>) {
    this.validateZoneCount(dto.zoneCount);
    return this.tc.save(this.tc.create({ ...dto, tournamentId, pointsPerSet: dto.pointsPerSet ?? 25, setsToWin: dto.setsToWin ?? 1, zoneSize: dto.zoneSize ?? 4, zoneCount: dto.zoneCount ?? null, registrationsOpen: dto.registrationsOpen ?? true }));
  }
  async updateCategory(id: number, dto: { pointsPerSet?: number; setsToWin?: number; zoneSize?: number; zoneCount?: number | null; registrationsOpen?: boolean }) {
    const category = await this.tc.findOneBy({ id });
    if (!category) throw new NotFoundException('Categoria de torneo no encontrada');
    this.validateZoneCount(dto.zoneCount);
    if (dto.pointsPerSet !== undefined) category.pointsPerSet = dto.pointsPerSet;
    if (dto.setsToWin !== undefined) category.setsToWin = dto.setsToWin;
    if (dto.zoneSize !== undefined) category.zoneSize = dto.zoneSize;
    if (dto.zoneCount !== undefined) category.zoneCount = dto.zoneCount;
    if (dto.registrationsOpen !== undefined) category.registrationsOpen = dto.registrationsOpen;
    return this.tc.save(category);
  }
  private validateZoneCount(count: number | null | undefined) {
    if (count != null && (!Number.isInteger(count) || count < 1 || count > 26)) throw new BadRequestException('La cantidad de zonas debe ser un entero entre 1 y 26.');
  }
  async createZone(dto: { tournamentCategoryId: number; venueId: number; name: string; capacity: number }) { if (!(await this.venues.findOneBy({ id: dto.venueId }))) throw new NotFoundException('Sede no encontrada'); return this.z.save(this.z.create(dto)); }
  async updateZone(id: number, dto: { name?: string; venueId?: number; capacity?: number }) {
    return this.withLockedZone(id, async (manager, zone) => {
      const originalName = zone.name;
      if (dto.capacity !== undefined && dto.capacity !== zone.capacity && await manager.getRepository(TournamentMatch).countBy({ zoneId: id })) throw new BadRequestException('No se puede cambiar el cupo de una zona con fixture generado');
      if (dto.venueId !== undefined) {
        const venue = await manager.getRepository(Venue).findOneBy({ id: dto.venueId });
        if (!venue) throw new NotFoundException('Sede no encontrada');
        if (!venue.active) throw new BadRequestException('Seleccioná una sede activa.');
        zone.venueId = venue.id; zone.venue = venue;
      }
      if (dto.capacity !== undefined) { if (dto.capacity < await manager.getRepository(ZoneEntry).countBy({ zoneId: id })) throw new BadRequestException('El cupo no puede ser menor a las parejas ya asignadas'); zone.capacity = dto.capacity; }
      if (dto.name !== undefined) zone.name = dto.name.trim();
      const category = await manager.getRepository(TournamentCategory).findOneBy({ id: zone.tournamentCategoryId });
      const repository = manager.getRepository(TournamentScheduleSlot);
      // The tournament lock also serializes zone edits and redistribution.
      await repository.createQueryBuilder('slot').where('slot.tournamentId = :tournamentId', { tournamentId: category!.tournamentId }).setLock('pessimistic_write').getMany();
      const slots = await repository.find({ where: { tournamentId: category!.tournamentId }, relations: { match: true } });
      const zoneSlots = slots.filter((slot) => slot.stage === 'ZONE' && (slot.match?.zoneId === zone.id || (!slot.matchId && slot.tournamentCategoryId === zone.tournamentCategoryId && slot.zoneName === originalName && slot.matchOrder <= zone.capacity)));
      const pending = zoneSlots.filter((slot) => ![MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(slot.match?.status as MatchStatus));
      if (dto.venueId !== undefined && pending.length) {
        const courts = await manager.getRepository(Court).find({ relations: { venue: true }, order: { id: 'ASC' } });
        // Stable match IDs also cover renamed zones and stale court assignments.
        for (const slot of pending) slot.zoneName = zone.name;
        const movingIds = new Set(pending.map((slot) => slot.id));
        redistributeExistingCourts(pending, [zone], courts, slots.filter((slot) => !movingIds.has(slot.id)), true);
        for (const slot of pending) await repository.update(slot.id, { courtId: slot.courtId, scheduledAt: slot.scheduledAt });
      }
      if (dto.name !== undefined) for (const slot of zoneSlots) await repository.update(slot.id, { zoneName: zone.name });
      const saved = await manager.getRepository(Zone).save(zone);
      if (dto.venueId !== undefined) await this.rememberZoneVenue(manager, saved);
      return saved;
    });
  }
  async removeZone(id: number) {
    return this.withLockedZone(id, async (manager, zone) => {
      const hasProgress = (match: TournamentMatch) => ![MatchStatus.DRAFT, MatchStatus.PENDING].includes(match.status) || !!(match.homeRegistrationId || match.awayRegistrationId || match.winnerRegistrationId) || match.homeScore != null || match.awayScore != null;
      const entries = await manager.getRepository(ZoneEntry).countBy({ zoneId: id });
      if (entries) throw new BadRequestException('No se puede eliminar la zona porque tiene parejas asignadas.');

      const matchesRepository = manager.getRepository(TournamentMatch);
      const zoneMatches = await matchesRepository.find({ where: { zoneId: id } });
      if (zoneMatches.some(hasProgress)) {
        throw new BadRequestException('No se puede eliminar la zona porque sus partidos tienen parejas o resultados cargados.');
      }

      const slotsRepository = manager.getRepository(TournamentScheduleSlot);
      const slots = await slotsRepository.find({ where: { tournamentCategoryId: zone.tournamentCategoryId }, relations: { match: true } });
      const knockoutSlots = slots.filter((slot) => slot.stage !== 'ZONE');
      if (knockoutSlots.some((slot) => slot.match && hasProgress(slot.match))) {
        throw new BadRequestException('No se puede eliminar la zona porque los cruces de la categoría ya tienen parejas o resultados cargados.');
      }
      const knockoutMatchIds = new Set(knockoutSlots.map((slot) => slot.matchId).filter((matchId): matchId is number => matchId !== null));
      const qualifiers = await matchesRepository.find({ where: [{ homeQualifierZoneId: id }, { awayQualifierZoneId: id }] });
      if (qualifiers.some((match) => !knockoutMatchIds.has(match.id))) throw new BadRequestException('No se puede eliminar la zona porque tiene cruces sin un programa asociado.');

      const zoneMatchIds = new Set(zoneMatches.map((match) => match.id));
      const zoneSlots = slots.filter((slot) => slot.stage === 'ZONE' && (slot.match?.zoneId === id || (slot.matchId !== null && zoneMatchIds.has(slot.matchId)) || (slot.matchId === null && slot.zoneName === zone.name)));
      const affectedSlots = [...zoneSlots, ...knockoutSlots];
      const knockoutMatches = knockoutSlots.flatMap((slot) => slot.match ? [slot.match] : []);
      if (affectedSlots.length) await slotsRepository.remove(affectedSlots);
      if (knockoutMatches.length) await matchesRepository.remove(knockoutMatches);
      if (zoneMatches.length) await matchesRepository.remove(zoneMatches);
      await manager.getRepository(Zone).remove(zone);
      return { success: true };
    });
  }
  addEntry(zoneId: number, registrationId: number) { return this.assignPlace(zoneId, registrationId); }

  async assignPlace(zoneId: number, registrationId?: number, requestedSeed?: number, localityId?: number) {
    return this.withLockedZone(zoneId, async (manager, zone) => {
      const category = await manager.getRepository(TournamentCategory).findOne({ where: { id: zone.tournamentCategoryId }, lock: { mode: 'pessimistic_write' } });
      if (!category) throw new NotFoundException('Categoria de torneo no encontrada');
      const registration = await this.resolveZoneRegistration(manager, category.categoryId, registrationId, localityId);
      registrationId = registration.id;
      if (registration.status !== RegistrationStatus.CONFIRMED || registration.categoryId !== category.categoryId) {
        throw new BadRequestException('Selecciona una pareja confirmada de esta categoria');
      }
      const matches = await manager.getRepository(TournamentMatch).find({ where: { zoneId }, order: { matchOrder: 'ASC' } });
      const entries = await this.orderedEntries(manager, zoneId);
      const capacity = matches.length === 3 ? 3 : zone.capacity;
      const seed = requestedSeed ?? Array.from({ length: capacity }, (_, index) => index + 1).find((position) => !entries.some((entry) => entry.seed === position));
      if (!seed || !Number.isInteger(seed) || seed < 1 || seed > capacity) throw new BadRequestException('El lugar no esta disponible en esta zona');
      const targetEntry = entries.find((item) => item.seed === seed);
      const sourceEntry = await manager.getRepository(ZoneEntry).findOne({ where: { registrationId, zone: { tournamentCategoryId: zone.tournamentCategoryId } } });
      if (sourceEntry && sourceEntry.id === targetEntry?.id) return { entry: sourceEntry, swappedEntry: null };

      const affectedZoneIds = [...new Set([zoneId, ...(sourceEntry ? [sourceEntry.zoneId] : [])])];
      const affectedMatches = await manager.getRepository(TournamentMatch).find({ where: affectedZoneIds.map((affectedZoneId) => ({ zoneId: affectedZoneId })) });
      if (affectedMatches.some((match) => [MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(match.status))) throw new BadRequestException('No se pueden intercambiar parejas cuando alguna de las zonas tiene un partido iniciado o resultados cargados');

      const repository = manager.getRepository(ZoneEntry);
      let swappedEntry: ZoneEntry | null = null;
      if (sourceEntry) {
        if (sourceEntry.zoneId === zoneId) {
          if (targetEntry) {
            // Inside one zone, keep each registration on its own row and swap
            // only the positions. Swapping registration ids sequentially would
            // temporarily duplicate a pair and violate zone_entries' unique key.
            const sourceSeed = sourceEntry.seed;
            sourceEntry.seed = targetEntry.seed;
            targetEntry.seed = sourceSeed;
            await repository.save([sourceEntry, targetEntry]);
            swappedEntry = targetEntry;
          } else {
            sourceEntry.seed = seed;
            await repository.save(sourceEntry);
          }
        } else {
          const previousRegistrationId = targetEntry?.registrationId ?? null;
          if (targetEntry) {
            targetEntry.registrationId = registrationId;
            await repository.save(targetEntry);
          } else {
            sourceEntry.zoneId = zoneId;
            sourceEntry.seed = seed;
          }
          if (previousRegistrationId !== null) {
            sourceEntry.registrationId = previousRegistrationId;
            swappedEntry = await repository.save(sourceEntry);
          } else if (!targetEntry) swappedEntry = await repository.save(sourceEntry);
        }
      } else if (targetEntry) {
        targetEntry.registrationId = registrationId;
        await repository.save(targetEntry);
      } else {
        await repository.save({ zoneId, registrationId, seed });
      }

      for (const affectedZoneId of affectedZoneIds) await this.syncZoneDirectParticipants(manager, affectedZoneId);
      return { entry: await repository.findOne({ where: { zoneId, registrationId } }), swappedEntry };
    });
  }

  private async resolveZoneRegistration(manager: EntityManager, categoryId: number, registrationId?: number, localityId?: number) {
    const registrations = manager.getRepository(PairRegistration);
    if (registrationId) {
      const registration = await registrations.findOneBy({ id: registrationId });
      if (!registration || registration.status !== RegistrationStatus.CONFIRMED || registration.categoryId !== categoryId) {
        throw new BadRequestException('Selecciona una pareja confirmada de esta categoria');
      }
      if (localityId && registration.localityId !== localityId) {
        const { locality, players } = await this.zoneRoster(manager, categoryId, localityId);
        if (!sameRegistrationRoster(registration, players)) throw new BadRequestException('La inscripcion elegida no corresponde al equipo activo seleccionado');
        await this.reconcileAdministrativeRegistration(manager, registration, locality, players);
      }
      return registration;
    }
    if (!localityId) throw new BadRequestException('Selecciona un equipo de esta categoria');

    const { locality, players } = await this.zoneRoster(manager, categoryId, localityId);
    const confirmed = await registrations.find({ where: { categoryId, status: RegistrationStatus.CONFIRMED } });
    const matching = confirmed.find((registration) => sameRegistrationRoster(registration, players));
    if (matching) {
      await this.reconcileAdministrativeRegistration(manager, matching, locality, players);
      return matching;
    }

    const grant = await manager.getRepository(RegistrationAccessGrant).save({
      token: `COPA-ADM-${randomBytes(8).toString('hex').toUpperCase()}`,
      categoryId,
      localityId: locality.id,
      contactName: players[0].fullName.trim(),
      contactEmail: null,
      contactPhone: players[0].phone!.trim(),
      notes: 'Habilitacion administrativa creada al incorporar el equipo al torneo.',
      feeWaived: true,
      paymentDeferredUntilConfirmed: false,
      status: RegistrationAccessGrantStatus.USED,
      consumedAt: new Date(),
    });
    return registrations.save(registrations.create({
      accessGrantId: grant.id,
      categoryId,
      localityId: locality.id,
      heardAboutSource: HeardAboutSource.OTHER,
      heardAboutOtherText: 'Alta administrativa',
      tournamentAvailabilityConfirmed: true,
      representingText: locality.name,
      contactEmail: null,
      feeWaived: true,
      paymentDeferredUntilConfirmed: false,
      ...registrationRoster(players),
      status: RegistrationStatus.CONFIRMED,
      adminNotes: 'Inscripcion administrativa creada al asignar el equipo a una zona.',
    }));
  }

  private async zoneRoster(manager: EntityManager, categoryId: number, localityId: number) {
    const locality = await manager.getRepository(Locality).findOneBy({ id: localityId });
    if (!locality || !locality.active || locality.categoryId !== categoryId) throw new BadRequestException('Selecciona un equipo activo de esta categoria');
    const players = await manager.getRepository(Player).find({ where: { localityId }, order: { id: 'ASC' } });
    if (players.length < 2 || players.length > 3) throw new BadRequestException('El equipo debe tener dos o tres jugadoras para incorporarlo a una zona');
    if (players.some((player) => !player.birthDate || !player.phone?.trim() || !player.shirtSize)) {
      throw new BadRequestException('Completa fecha de nacimiento, telefono y talle de todas las jugadoras antes de incorporar el equipo a una zona');
    }
    return { locality, players };
  }

  private async reconcileAdministrativeRegistration(manager: EntityManager, registration: PairRegistration, locality: Locality, players: Player[]) {
    registration.localityId = locality.id;
    registration.representingText = locality.name;
    Object.assign(registration, registrationRoster(players));
    await manager.getRepository(PairRegistration).save(registration);
    const grantRegistrations = await manager.getRepository(PairRegistration).count({ where: { accessGrantId: registration.accessGrantId } });
    if (grantRegistrations === 1) {
      await manager.getRepository(RegistrationAccessGrant).update(registration.accessGrantId, {
        localityId: locality.id,
        categoryId: registration.categoryId,
        contactName: players[0].fullName.trim(),
        contactPhone: players[0].phone!.trim(),
      });
    }
  }

  private async syncZoneDirectParticipants(manager: EntityManager, zoneId: number) {
    const entries = await this.orderedEntries(manager, zoneId);
    const positions = new Map(entries.map((entry) => [entry.seed, entry.registrationId]));
    const repository = manager.getRepository(TournamentMatch);
    const matches = await repository.find({ where: { zoneId }, order: { matchOrder: 'ASC' } });
    const zone = await manager.getRepository(Zone).findOne({ where: { id: zoneId }, relations: { tournamentCategory: true } });
    if (!zone) throw new NotFoundException('Zona no encontrada');
    const definitions = zoneMatchDefinitions(zone.capacity, zone.tournamentCategory?.methodology ?? ZoneMethodology.PROVINCE);
    for (const match of matches) {
      const definition = definitions.find((item) => item.order === match.matchOrder);
      if (!definition) continue;
      if (definition.home.source === 'DIRECT') match.homeRegistrationId = positions.get(definition.home.seed) ?? null;
      if (definition.away.source === 'DIRECT') match.awayRegistrationId = positions.get(definition.away.seed) ?? null;
      match.status = match.homeRegistrationId && match.awayRegistrationId ? MatchStatus.READY : MatchStatus.PENDING;
      await repository.save(match);
    }
  }

  private withLockedZone<T>(zoneId: number, action: (manager: EntityManager, zone: Zone) => Promise<T>) {
    return this.z.manager.transaction(async (manager) => {
      const initial = await manager.getRepository(Zone).findOne({ where: { id: zoneId } });
      if (!initial) throw new NotFoundException('Zona no encontrada');
      const category = await manager.getRepository(TournamentCategory).findOneBy({ id: initial.tournamentCategoryId });
      if (!category) throw new NotFoundException('Categoria no encontrada');
      await manager.getRepository(Tournament).findOne({ where: { id: category.tournamentId }, lock: { mode: 'pessimistic_write' } });
      const zone = await manager.getRepository(Zone).findOne({ where: { id: zoneId }, lock: { mode: 'pessimistic_write' } });
      if (!zone) throw new NotFoundException('Zona no encontrada');
      return action(manager, zone);
    });
  }

  private async orderedEntries(manager: EntityManager, zoneId: number) {
    const repository = manager.getRepository(ZoneEntry);
    const entries = await repository.find({ where: { zoneId }, order: { seed: 'ASC', id: 'ASC' } });
    // Older manually assigned entries all used seed 0. Preserve their existing order.
    if (entries.some((entry) => entry.seed < 1) || new Set(entries.map((entry) => entry.seed)).size !== entries.length) {
      entries.forEach((entry, index) => { entry.seed = index + 1; });
      await repository.save(entries);
    }
    return entries;
  }

  async divideZones(tournamentCategoryId: number) {
    const category = await this.tc.findOne({ where: { id: tournamentCategoryId }, relations: { category: true } });
    if (!category) throw new NotFoundException('Categoria de torneo no encontrada');
    const existing = await this.z.find({ where: { tournamentCategoryId } });
    if (existing.length && await this.m.count({ where: existing.map((zone) => ({ zoneId: zone.id })) })) throw new BadRequestException('No se pueden redistribuir zonas que ya tienen fixture generado.');
    if (existing.length && await this.e.count({ where: existing.map((zone) => ({ zoneId: zone.id })) })) throw new BadRequestException('No se pueden redistribuir zonas que ya tienen parejas asignadas.');
    const registrations = (await this.r.find({ where: { categoryId: category.categoryId, status: RegistrationStatus.CONFIRMED }, relations: { locality: true }, order: { id: 'ASC' } }))
      .sort((left, right) => left.locality.name.localeCompare(right.locality.name, 'es') || left.id - right.id);
    const count = category.zoneCount ?? Math.max(1, Math.ceil(registrations.length / category.zoneSize));
    const capacities = category.zoneCapacities?.length ? category.zoneCapacities : Array.from({ length: count }, () => category.zoneSize);
    const places = capacities.reduce((sum, capacity) => sum + capacity, 0);
    if (registrations.length > places) throw new BadRequestException(`Hay ${registrations.length} parejas confirmadas y solo ${places} lugares configurados. Aumentá la cantidad de zonas antes de dividir.`);
    const venues = await this.venues.find({ where: { active: true }, order: { name: 'ASC' } });
    if (!venues.length) throw new BadRequestException('Debes habilitar al menos una sede antes de dividir las zonas.');
    if (existing.length) await this.z.remove(existing);
    const zones = await this.z.save(capacities.map((capacity, index) => this.z.create({ tournamentCategoryId, venueId: venues[index % venues.length].id, name: `Zona ${String.fromCharCode(65 + index)}`, capacity })));
    const assignments = zones.map((zone) => ({ zone, entries: [] as PairRegistration[] }));
    for (const registration of registrations) {
      const eligible = assignments.filter((item) => item.entries.length < item.zone.capacity && !item.entries.some((entry) => entry.localityId === registration.localityId));
      const target = (eligible.length ? eligible : assignments.filter((item) => item.entries.length < item.zone.capacity)).sort((a, b) => a.entries.length / a.zone.capacity - b.entries.length / b.zone.capacity)[0];
      target.entries.push(registration);
      await this.e.save(this.e.create({ zoneId: target.zone.id, registrationId: registration.id, seed: target.entries.length }));
    }
    return this.z.find({ where: { tournamentCategoryId }, order: { name: 'ASC' } });
  }

  async distributionPreview(tournamentId: number) {
    return this.t.manager.transaction((manager) => this.distributionPreviewInManager(manager, tournamentId));
  }

  async setDistributionVenue(tournamentId: number, dto: { tournamentCategoryId: number; zoneIndex: number; venueId: number }) {
    const preview = await this.distributionPreview(tournamentId);
    if (preview.hasResults) throw new BadRequestException('No se puede rearmar la distribución porque el torneo ya tiene resultados.');
    const plan = preview.plans.find((item) => item.tournamentCategoryId === dto.tournamentCategoryId);
    if (!plan || dto.zoneIndex < 0 || dto.zoneIndex >= plan.zones.length) throw new BadRequestException('La zona proyectada ya no existe. Recalculá la distribución.');
    if (!preview.venues.some((venue) => venue.id === dto.venueId)) throw new BadRequestException('Seleccioná una sede activa.');
    // Persist the complete explicit plan currently shown, replacing only the
    // selected position. Unassigned zones remain unassigned: there is no
    // automatic venue choice or sibling update behind this edit.
    const assignments = preview.plans.flatMap((category) => category.zones.flatMap((zone, zoneIndex) => {
      const venueId = category.tournamentCategoryId === dto.tournamentCategoryId && zoneIndex === dto.zoneIndex
        ? dto.venueId
        : zone.venue?.id;
      return venueId ? [{ tournamentCategoryId: category.tournamentCategoryId, zoneIndex, venueId, directorAssigned: true }] : [];
    }));
    await this.t.manager.getRepository(TournamentZoneVenuePlan).upsert(assignments, { conflictPaths: ['tournamentCategoryId', 'zoneIndex'] });
    return this.distributionPreview(tournamentId);
  }

  async setDistributionLayout(tournamentId: number, dto: { tournamentCategoryId: number; capacities?: number[] | null; methodology?: ZoneMethodology; qualifiersPerZone?: number }) {
    return this.t.manager.transaction(async (manager) => {
      const tournament = await manager.getRepository(Tournament).findOne({ where: { id: tournamentId }, lock: { mode: 'pessimistic_write' } });
      if (!tournament) throw new NotFoundException('Torneo no encontrado');
      const current = await this.distributionPreviewInManager(manager, tournamentId);
      if (current.hasResults) throw new BadRequestException('No se puede cambiar la cantidad de zonas porque el torneo ya tiene resultados.');
      const category = await manager.getRepository(TournamentCategory).findOneBy({ id: dto.tournamentCategoryId, tournamentId });
      if (!category) throw new NotFoundException('Categoria de torneo no encontrada');
      if (dto.capacities !== undefined && dto.capacities !== null) {
        if (dto.capacities.length < 1 || dto.capacities.length > 4) throw new BadRequestException('Configura entre una y cuatro zonas.');
        if (dto.capacities.some((capacity) => capacity !== 3 && capacity !== 4)) throw new BadRequestException('Cada zona debe tener capacidad para 3 o 4 parejas.');
        const registrationCount = current.plans.find((plan) => plan.tournamentCategoryId === category.id)?.registrationCount ?? 0;
        const places = dto.capacities.reduce((sum, capacity) => sum + capacity, 0);
        if (places < registrationCount) throw new BadRequestException(`Hay ${registrationCount} parejas presentes y la configuracion solo tiene ${places} lugares.`);
      }
      if (dto.capacities !== undefined) {
        category.zoneCapacities = dto.capacities ? [...dto.capacities] : null;
        category.zoneCount = dto.capacities?.length ?? null;
        if (dto.capacities?.length && dto.capacities.every((capacity) => capacity === dto.capacities![0])) category.zoneSize = dto.capacities[0];
      }
      if (dto.methodology !== undefined) category.methodology = dto.methodology;
      if (dto.qualifiersPerZone !== undefined) category.qualifiersPerZone = dto.qualifiersPerZone;
      await manager.getRepository(TournamentCategory).save(category);
      if (dto.capacities) await manager.getRepository(TournamentZoneVenuePlan).delete({
        tournamentCategoryId: category.id, zoneIndex: MoreThanOrEqual(dto.capacities.length),
      });
      return this.distributionPreviewInManager(manager, tournamentId);
    });
  }

  private distributionRegistration(registration: PairRegistration): DistributionRegistration {
    return {
      id: registration.id,
      localityId: registration.localityId,
      localityName: registration.locality.name,
      label: registration.representingText?.trim() || playerLabel(registration),
    };
  }

  private async distributionPreviewInManager(manager: EntityManager, tournamentId: number) {
    const tournament = await manager.getRepository(Tournament).findOneBy({ id: tournamentId });
    if (!tournament) throw new NotFoundException('Torneo no encontrado');
    const categories = await manager.getRepository(TournamentCategory).find({
      where: { tournamentId }, relations: { category: true }, order: { id: 'ASC' },
    });
    await this.materializeManualTeams(manager, categories);
    const categoryIds = categories.map((category) => category.categoryId);
    const registrations = categoryIds.length ? await manager.getRepository(PairRegistration).find({
      where: { categoryId: In(categoryIds), status: RegistrationStatus.CONFIRMED }, relations: { locality: true }, order: { id: 'ASC' },
    }) : [];
    const attendanceRows = await manager.getRepository(TournamentRegistrationAttendance).find({ where: { tournamentId }, order: { id: 'ASC' } });
    const attendanceByRegistration = new Map(attendanceRows.map((row) => [row.registrationId, row.present]));
    const eligibleRegistrations = registrations.filter((registration) => attendanceByRegistration.get(registration.id) !== false);
    const attendance = registrations.map((registration) => {
      const category = categories.find((item) => item.categoryId === registration.categoryId)!;
      return { ...this.distributionRegistration(registration), tournamentCategoryId: category.id, categoryName: category.category.name, present: attendanceByRegistration.get(registration.id) !== false };
    });
    const venues = await manager.getRepository(Venue).find({ where: { active: true }, order: { name: 'ASC' } });
    const venuePlans = categories.length ? await manager.getRepository(TournamentZoneVenuePlan).find({
      where: categories.map((category) => ({ tournamentCategoryId: category.id, directorAssigned: true })), order: { tournamentCategoryId: 'ASC', zoneIndex: 'ASC' },
    }) : [];
    const zones = await manager.getRepository(Zone).find({
      where: { tournamentCategory: { tournamentId } }, relations: { venue: true, tournamentCategory: { category: true } }, order: { tournamentCategoryId: 'ASC', name: 'ASC' },
    });
    const zoneIds = zones.map((zone) => zone.id);
    const entries = zoneIds.length ? await manager.getRepository(ZoneEntry).find({
      where: { zoneId: In(zoneIds) }, relations: { registration: { locality: true } }, order: { seed: 'ASC', id: 'ASC' },
    }) : [];
    const zoneMatches = zoneIds.length ? await manager.getRepository(TournamentMatch).find({ where: { zoneId: In(zoneIds) } }) : [];
    const zoneMatchCount = zoneMatches.length;
    const slots = await manager.getRepository(TournamentScheduleSlot).find({ where: { tournamentId }, order: { sequence: 'ASC' } });
    const matchCount = Math.max(zoneMatchCount, slots.filter((slot) => slot.matchId).length);
    const slotMatchIds = slots.flatMap((slot) => slot.matchId ? [slot.matchId] : []);
    const slotMatches = slotMatchIds.length ? await manager.getRepository(TournamentMatch).find({ where: { id: In(slotMatchIds) } }) : [];
    const hasResults = [...zoneMatches, ...slotMatches].some((match) => [MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(match.status));
    const rules = [
      'El armado usa únicamente inscripciones confirmadas; los tokens emitidos todavía no confirmados no se incluyen.',
      'Los equipos activos creados a mano, sin token pendiente y con su nómina completa, se incorporan como inscripciones administrativas.',
      'Dirección debe asignar cada zona a una sede antes de generar los partidos; no hay autoasignación de sedes.',
      'Dirección puede configurar entre una y cuatro zonas, con capacidad de 3 o 4 parejas cada una.',
      'Cada categoría usa Metodología Provincia o Todos contra todas; la elección se aplica a todas sus zonas y cambia su fixture real.',
      'La primera etapa eliminatoria se infiere con las clasificadas: 8 juegan cuartos, 4 semifinales y 2 final.',
      'Si no hay una configuración manual, el sistema calcula automáticamente zonas completas de 3 o 4 parejas.',
      'Una configuración puede dejar lugares libres para incorporar nuevas parejas confirmadas sin empezar de cero.',
      'Las parejas de una misma localidad comparten sede, pero se ubican en zonas diferentes.',
      'Entre categorias distintas se intenta conservar la misma sede para una localidad.',
      'Los partidos generados son los mismos que se consultan y editan desde Programa - Mapa.',
    ];
    const snapshot = {
      tournament: { id: tournament.id, updatedAt: (tournament as Tournament & { updatedAt?: Date }).updatedAt },
      categories: categories.map((category) => ({ id: category.id, categoryId: category.categoryId, name: category.category.name, zoneCapacities: category.zoneCapacities, methodology: category.methodology, qualifiersPerZone: category.qualifiersPerZone })),
      registrations: registrations.map((registration) => ({ id: registration.id, categoryId: registration.categoryId, localityId: registration.localityId, updatedAt: registration.updatedAt })),
      attendance: attendanceRows.map((row) => ({ registrationId: row.registrationId, present: row.present, updatedAt: row.updatedAt })),
      venues: venues.map((venue) => ({ id: venue.id, name: venue.name, active: venue.active })),
      venuePlans: venuePlans.map((plan) => ({ categoryId: plan.tournamentCategoryId, zoneIndex: plan.zoneIndex, venueId: plan.venueId })),
      zones: zones.map((zone) => ({ id: zone.id, categoryId: zone.tournamentCategoryId, venueId: zone.venueId, name: zone.name, capacity: zone.capacity })),
      entries: entries.map((entry) => ({ id: entry.id, zoneId: entry.zoneId, registrationId: entry.registrationId, seed: entry.seed })),
      slots: slots.map((slot) => ({ id: slot.id, matchId: slot.matchId, sequence: slot.sequence })),
    };
    const baseVersion = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

    const existingAssignments = new Map<string, { zoneIndex: number; venueId: number }>();
    for (const category of categories) {
      const categoryZones = zones.filter((zone) => zone.tournamentCategoryId === category.id);
      categoryZones.forEach((zone, zoneIndex) => {
        entries.filter((entry) => entry.zoneId === zone.id).forEach((entry) => existingAssignments.set(`${category.id}:${entry.registrationId}`, { zoneIndex, venueId: zone.venueId }));
      });
    }
    const planned = planTournamentDistribution(categories.map((category) => ({
      id: category.id,
      name: category.category.name,
      capacities: category.zoneCapacities,
      methodology: category.methodology,
      qualifiersPerZone: category.qualifiersPerZone,
      registrations: eligibleRegistrations.filter((registration) => registration.categoryId === category.categoryId).map((registration) => this.distributionRegistration(registration)),
    })), venues.map((venue) => ({ id: venue.id, name: venue.name })), new Map(venuePlans.map((plan) => [`${plan.tournamentCategoryId}:${plan.zoneIndex}`, plan.venueId])), existingAssignments);
    const currentSignature = JSON.stringify(categories.map((category) => zones.filter((zone) => zone.tournamentCategoryId === category.id).map((zone) => ({
      name: zone.name, capacity: zone.capacity, venueId: zone.venueId,
      registrations: entries.filter((entry) => entry.zoneId === zone.id).map((entry) => entry.registrationId).sort((left, right) => left - right),
    }))));
    const plannedSignature = JSON.stringify(planned.map((plan) => plan.zones.map((zone) => ({
      name: zone.name, capacity: zone.capacity, venueId: zone.venue?.id ?? null,
      registrations: zone.registrations.map((registration) => registration.id).sort((left, right) => left - right),
    }))));
    const slotMatchById = new Map(slotMatches.map((match) => [match.id, match]));
    const fixturesMatchConfiguration = zones.every((zone) => {
      const matches = zoneMatches.filter((match) => match.zoneId === zone.id).sort((left, right) => left.matchOrder - right.matchOrder);
      const definitions = zoneMatchDefinitions(zone.capacity, zone.tournamentCategory.methodology ?? ZoneMethodology.PROVINCE);
      if (matches.length !== definitions.length) return false;
      const registrationBySeed = new Map(entries.filter((entry) => entry.zoneId === zone.id).map((entry) => [entry.seed, entry.registrationId]));
      const matchByOrder = new Map(matches.map((match) => [match.matchOrder, match]));
      const sideMatches = (match: TournamentMatch, side: 'home' | 'away', participant: ZoneParticipantDefinition) => {
        const source = side === 'home' ? match.homeSource : match.awaySource;
        const registrationId = side === 'home' ? match.homeRegistrationId : match.awayRegistrationId;
        const sourceMatchId = side === 'home' ? match.homeSourceMatchId : match.awaySourceMatchId;
        if (source !== participant.source) return false;
        if (participant.source === 'DIRECT') return registrationId === (registrationBySeed.get(participant.seed) ?? null) && sourceMatchId === null;
        return sourceMatchId === (matchByOrder.get(participant.matchOrder)?.id ?? null);
      };
      return definitions.every((definition, index) => sideMatches(matches[index], 'home', definition.home) && sideMatches(matches[index], 'away', definition.away));
    }) && categories.every((category) => {
      const categoryZones = zones.filter((zone) => zone.tournamentCategoryId === category.id).sort((left, right) => left.name.localeCompare(right.name, 'es', { numeric: true }));
      if (!categoryZones.length) return true;
      const firstStage = inferredKnockoutStage(categoryZones.length, category.qualifiersPerZone ?? 2);
      if (!firstStage) return false;
      const stages: Array<'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL'> = firstStage === 'QUARTERFINAL' ? ['QUARTERFINAL', 'SEMIFINAL', 'FINAL'] : firstStage === 'SEMIFINAL' ? ['SEMIFINAL', 'FINAL'] : ['FINAL'];
      const expectedCounts = { QUARTERFINAL: 4, SEMIFINAL: 2, FINAL: 1 } as const;
      const categorySlots = slots.filter((slot) => slot.tournamentCategoryId === category.id && slot.stage !== 'ZONE');
      if (categorySlots.some((slot) => !stages.includes(slot.stage as 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL'))) return false;
      if (stages.some((stage) => categorySlots.filter((slot) => slot.stage === stage).length !== expectedCounts[stage])) return false;
      const qualifierPairs = directQualifierPairs(categoryZones, category.qualifiersPerZone ?? 2);
      return categorySlots.filter((slot) => slot.stage === firstStage).every((slot) => {
        const match = slot.matchId ? slotMatchById.get(slot.matchId) : undefined;
        const qualifiers = qualifierPairs[slot.matchOrder - 1];
        return Boolean(match && qualifiers
          && match.homeQualifierZoneId === qualifiers[0].zoneId && match.homeQualifierRank === qualifiers[0].rank
          && match.awayQualifierZoneId === qualifiers[1].zoneId && match.awayQualifierRank === qualifiers[1].rank);
      });
    });

    if (matchCount && (hasResults || (currentSignature === plannedSignature && fixturesMatchConfiguration))) {
      const plans = categories.map((category) => {
        const categoryZones = zones.filter((zone) => zone.tournamentCategoryId === category.id);
        const venueIds = new Set(categoryZones.map((zone) => zone.venueId));
        return {
          tournamentCategoryId: category.id,
          categoryName: category.category.name,
          registrationCount: categoryZones.reduce((sum, zone) => sum + entries.filter((entry) => entry.zoneId === zone.id).length, 0),
          newRegistrationCount: 0,
          capacities: categoryZones.map((zone) => zone.capacity),
           layoutMode: category.zoneCapacities?.length ? 'MANUAL' as const : 'AUTOMATIC' as const,
           methodology: category.methodology ?? ZoneMethodology.PROVINCE,
           qualifiersPerZone: category.qualifiersPerZone ?? 2,
           nextStage: inferredKnockoutStage(categoryZones.length, category.qualifiersPerZone ?? 2),
          venue: venueIds.size === 1 ? categoryZones[0]?.venue ?? null : null,
          zones: categoryZones.map((zone) => ({
            id: zone.id, name: zone.name, capacity: zone.capacity, venue: zone.venue, venueAssignment: 'APPLIED' as const,
            registrations: entries.filter((entry) => entry.zoneId === zone.id).map((entry) => this.distributionRegistration(entry.registration)),
          })),
          warnings: [],
        };
      });
      return { tournament: { id: tournament.id, name: tournament.name }, mode: 'CURRENT' as const, canApply: false, baseVersion, matchCount, hasResults, replacesPendingFixture: false, rules, plans, attendance, venues: venues.map(({ id, name }) => ({ id, name })) };
    }

    const plans = planned.map((plan) => ({
      ...plan,
      newRegistrationCount: matchCount ? eligibleRegistrations.filter((registration) => {
        const category = categories.find((item) => item.categoryId === registration.categoryId);
        return category?.id === plan.tournamentCategoryId && !existingAssignments.has(`${plan.tournamentCategoryId}:${registration.id}`);
      }).length : 0,
    }));
    const populated = plans.filter((plan) => plan.registrationCount > 0);
    const complete = populated.every((plan) => plan.capacities.length > 0 && plan.nextStage !== null && plan.zones.reduce((sum, zone) => sum + zone.registrations.length, 0) === plan.registrationCount);
    return {
      tournament: { id: tournament.id, name: tournament.name }, mode: 'PREVIEW' as const,
      canApply: Boolean(!hasResults && venues.length && populated.length && complete), baseVersion, matchCount, hasResults, replacesPendingFixture: matchCount > 0, rules, plans, attendance, venues: venues.map(({ id, name }) => ({ id, name })),
    };
  }

  private async materializeManualTeams(manager: EntityManager, categories: TournamentCategory[]) {
    const categoryIds = categories.map((category) => category.categoryId);
    if (!categoryIds.length) return;
    const localities = await manager.getRepository(Locality).find({
      where: { active: true, categoryId: In(categoryIds) }, order: { id: 'ASC' },
    });
    if (!localities.length) return;
    const localityIds = localities.map((locality) => locality.id);
    const [registrations, grants, players] = await Promise.all([
      manager.getRepository(PairRegistration).find({ where: { categoryId: In(categoryIds) } }),
      manager.getRepository(RegistrationAccessGrant).find({ where: { categoryId: In(categoryIds), localityId: In(localityIds) } }),
      manager.getRepository(Player).find({ where: { localityId: In(localityIds) }, order: { id: 'ASC' } }),
    ]);
    for (const locality of localities) {
      if (!locality.categoryId) continue;
      if (registrations.some((registration) => registration.categoryId === locality.categoryId && registration.localityId === locality.id)) continue;
      // A grant without a registration is an unused invitation. It must remain
      // outside the zones until the team confirms it through the normal form.
      if (grants.some((grant) => grant.categoryId === locality.categoryId && grant.localityId === locality.id)) continue;
      const roster = players.filter((player) => player.localityId === locality.id);
      if (roster.length < 2 || roster.length > 3 || roster.some((player) => !player.birthDate || !player.phone?.trim() || !player.shirtSize)) continue;
      await this.resolveZoneRegistration(manager, locality.categoryId, undefined, locality.id);
    }
  }

  async applyDistribution(tournamentId: number, baseVersion: string, resetProgram = false) {
    return this.t.manager.transaction(async (manager) => {
      const tournament = await manager.getRepository(Tournament).findOne({ where: { id: tournamentId }, lock: { mode: 'pessimistic_write' } });
      if (!tournament) throw new NotFoundException('Torneo no encontrado');
      const preview = await this.distributionPreviewInManager(manager, tournamentId);
      if (preview.mode === 'CURRENT') throw new BadRequestException('El torneo ya tiene partidos generados. Editalos desde Programa - Mapa.');
      if (preview.baseVersion !== baseVersion) throw new BadRequestException('Las inscripciones, sedes o zonas cambiaron desde la vista previa. Volve a calcular la distribucion.');
      if (!preview.canApply) throw new BadRequestException('La distribucion tiene observaciones que impiden aplicarla. Revisa las categorias, parejas confirmadas y sedes activas.');

      const zoneRepository = manager.getRepository(Zone);
      const existingZones = await zoneRepository.find({ where: { tournamentCategory: { tournamentId } } });
      const existingZoneIds = existingZones.map((zone) => zone.id);
      const slotsRepository = manager.getRepository(TournamentScheduleSlot);
      const existingSlots = await slotsRepository.find({ where: { tournamentId }, relations: programRelations });
      const matchIds = new Set(existingSlots.flatMap((slot) => slot.matchId ? [slot.matchId] : []));
      if (existingZoneIds.length) {
        const related = await manager.getRepository(TournamentMatch).find({ where: [
          { zoneId: In(existingZoneIds) }, { homeQualifierZoneId: In(existingZoneIds) }, { awayQualifierZoneId: In(existingZoneIds) },
        ] });
        related.forEach((match) => matchIds.add(match.id));
      }
      await manager.getRepository(TournamentScheduleSlot).delete({ tournamentId });
      if (matchIds.size) await manager.getRepository(TournamentMatch).delete({ id: In([...matchIds]) });
      if (existingZones.length) await zoneRepository.remove(existingZones);
      for (const plan of preview.plans.filter((item) => item.registrationCount > 0)) {
        for (const [zoneIndex, plannedZone] of plan.zones.entries()) {
          const venue = plannedZone.venue ?? plan.venue;
          if (!venue) throw new BadRequestException(`No se pudo asignar una sede a ${plan.categoryName} - ${plannedZone.name}.`);
          await manager.getRepository(TournamentZoneVenuePlan).upsert({
            tournamentCategoryId: plan.tournamentCategoryId, zoneIndex, venueId: venue.id, directorAssigned: true,
          }, { conflictPaths: ['tournamentCategoryId', 'zoneIndex'] });
          const zone = await zoneRepository.save(zoneRepository.create({
            tournamentCategoryId: plan.tournamentCategoryId, venueId: venue.id, name: plannedZone.name, capacity: plannedZone.capacity,
          }));
          if (plannedZone.registrations.length) await manager.getRepository(ZoneEntry).save(plannedZone.registrations.map((registration, index) => manager.getRepository(ZoneEntry).create({
            zoneId: zone.id, registrationId: registration.id, seed: index + 1,
          })));
        }
      }
      await this.buildScheduleGrid(manager, tournamentId);
      if (!resetProgram && existingSlots.length) {
        const generatedSlots = await slotsRepository.find({ where: { tournamentId }, relations: programRelations, order: { sequence: 'ASC' } });
        for (const assignment of preservedProgramAssignments(existingSlots, generatedSlots)) {
          await slotsRepository.update(assignment.id, { courtId: assignment.courtId, scheduledAt: assignment.scheduledAt });
        }
      }
      return this.distributionPreviewInManager(manager, tournamentId);
    });
  }

  async setAttendance(tournamentId: number, registrationId: number, present: boolean) {
    return this.t.manager.transaction(async (manager) => {
      const tournament = await manager.getRepository(Tournament).findOne({ where: { id: tournamentId }, lock: { mode: 'pessimistic_write' } });
      if (!tournament) throw new NotFoundException('Torneo no encontrado');
      const categories = await manager.getRepository(TournamentCategory).find({ where: { tournamentId } });
      const registration = await manager.getRepository(PairRegistration).findOneBy({ id: registrationId });
      if (!registration || registration.status !== RegistrationStatus.CONFIRMED || !categories.some((category) => category.categoryId === registration.categoryId)) throw new NotFoundException('La pareja confirmada no pertenece a este torneo.');
      if ((await this.distributionPreviewInManager(manager, tournamentId)).hasResults) throw new BadRequestException('No se puede cambiar la asistencia porque el torneo ya tiene resultados cargados.');
      const repository = manager.getRepository(TournamentRegistrationAttendance);
      let attendance = await repository.findOneBy({ tournamentId, registrationId });
      if (!attendance) attendance = repository.create({ tournamentId, registrationId, present });
      else attendance.present = present;
      await repository.save(attendance);
      return this.distributionPreviewInManager(manager, tournamentId);
    });
  }

  async scheduleGrid(tournamentId: number) {
    return this.slots.manager.transaction(async (manager) => {
      await manager.getRepository(Tournament).findOne({ where: { id: tournamentId }, lock: { mode: 'pessimistic_write' } });
      const zones = await manager.getRepository(Zone).find({ where: { tournamentCategory: { tournamentId } }, order: { id: 'ASC' } });
      for (const zone of zones) await manager.getRepository(Zone).findOne({ where: { id: zone.id }, lock: { mode: 'pessimistic_write' } });
      return this.buildScheduleGrid(manager, tournamentId);
    });
  }

  private async buildScheduleGrid(manager: EntityManager, tournamentId: number) {
    const slotsRepository = manager.getRepository(TournamentScheduleSlot);
    const zonesRepository = manager.getRepository(Zone);
    const tournament = await manager.getRepository(Tournament).findOneBy({ id: tournamentId });
    if (!tournament) throw new NotFoundException('Torneo no encontrado');
    const [zones, courts] = await Promise.all([zonesRepository.find({ where: { tournamentCategory: { tournamentId } }, relations: { venue: true, tournamentCategory: true }, order: { tournamentCategoryId: 'ASC', name: 'ASC' } }), manager.getRepository(Court).find({ where: { active: true }, relations: { venue: true }, order: { id: 'ASC' } })]);
    const existing = await slotsRepository.find({ where: { tournamentId }, order: { sequence: 'ASC' } });
    const days = this.programDays(tournament);
    const generated: TournamentScheduleSlot[] = [];
    const existingWithMatches = await slotsRepository.find({ where: { tournamentId }, relations: { match: true } });
    const findExisting = (zone: Zone, order: number) => existingWithMatches.find((slot) => slot.stage === 'ZONE' && slot.matchOrder === order && (slot.match?.zoneId === zone.id || (!slot.matchId && slot.tournamentCategoryId === zone.tournamentCategoryId && slot.zoneName === zone.name)));
    let sequence = Math.max(0, ...existing.map((slot) => slot.sequence));
    {
      const venueQueues = new Map<number, { zone: Zone; nextOrder: number; gameCount: number }[]>();
      for (const zone of zones) {
        const methodology = zone.tournamentCategory?.methodology ?? ZoneMethodology.PROVINCE;
        venueQueues.set(zone.venueId, [...(venueQueues.get(zone.venueId) ?? []), { zone, nextOrder: 1, gameCount: zoneMatchDefinitions(zone.capacity, methodology).length }]);
      }
      const venueIds = [...venueQueues.keys()].sort((left, right) => left - right);
      while ([...venueQueues.values()].some((queue) => queue.some((item) => item.nextOrder <= item.gameCount))) {
        for (const venueId of venueIds) {
          const queue = venueQueues.get(venueId)!;
          const next = queue.find((item) => item.nextOrder <= item.gameCount);
          if (!next) continue;
          if (!findExisting(next.zone, next.nextOrder)) {
            sequence += 1;
            generated.push(slotsRepository.create({ tournamentId, tournamentCategoryId: next.zone.tournamentCategoryId, zoneName: next.zone.name, matchOrder: next.nextOrder, stage: 'ZONE', sequence, courtId: null, scheduledAt: null }));
          }
          next.nextOrder += 1;
          queue.push(queue.shift()!);
        }
      }
      const knockoutCategories = [...new Set(zones.map((zone) => zone.tournamentCategoryId))].map((categoryId) => {
        const categoryZones = zones.filter((zone) => zone.tournamentCategoryId === categoryId);
        return { categoryId, zones: categoryZones, firstStage: inferredKnockoutStage(categoryZones.length, categoryZones[0]?.tournamentCategory?.qualifiersPerZone ?? 2) };
      }).filter((item) => item.firstStage !== null);
      const knockoutStages = [{ stage: 'QUARTERFINAL', label: 'Cuartos de final', matches: 4 }, { stage: 'SEMIFINAL', label: 'Semifinal', matches: 2 }, { stage: 'FINAL', label: 'Final', matches: 1 }] as const;
      for (const knockoutStage of knockoutStages) for (const category of knockoutCategories.filter((item) => knockoutStages.findIndex((stage) => stage.stage === knockoutStage.stage) >= knockoutStages.findIndex((stage) => stage.stage === item.firstStage))) for (let matchOrder = 1; matchOrder <= knockoutStage.matches; matchOrder += 1) {
        if (existing.some((slot) => slot.tournamentCategoryId === category.categoryId && slot.stage === knockoutStage.stage && slot.matchOrder === matchOrder)) continue;
        sequence += 1;
        generated.push(slotsRepository.create({ tournamentId, tournamentCategoryId: category.categoryId, zoneName: knockoutStage.label, matchOrder, stage: knockoutStage.stage, sequence, courtId: null, scheduledAt: null }));
      }
      // Automatic scheduling only for a brand-new program. Later additions remain available for scheduling without moving existing games.
      if (!existing.length) distributeProgramCourts(generated, zones, courts, (venue, index) => this.programDate(days, venue.startsAt, venue.matchDurationMinutes, venue.matchesPerDay, index));
      if (generated.length) await slotsRepository.save(generated);
    }
    for (const zone of zones) await this.fixtureInManager(manager, zone);
    await this.ensureKnockoutMatches(manager, tournamentId, zones);
    return programView(await slotsRepository.find({ where: { tournamentId }, relations: programRelations, order: { sequence: 'ASC' } }));
  }

  async redistributeCourts(tournamentId: number) {
    return this.slots.manager.transaction(async (manager) => {
      const tournament = await manager.getRepository(Tournament).findOne({ where: { id: tournamentId }, lock: { mode: 'pessimistic_write' } });
      if (!tournament) throw new NotFoundException('Torneo no encontrado');
      const zoneRepository = manager.getRepository(Zone);
      const zoneLocks = await zoneRepository.find({ where: { tournamentCategory: { tournamentId } }, order: { id: 'ASC' } });
      for (const zone of zoneLocks) await zoneRepository.findOne({ where: { id: zone.id }, lock: { mode: 'pessimistic_write' } });
      // The director can add categories/zones without reopening Programa first.
      await this.buildScheduleGrid(manager, tournamentId);
      const repository = manager.getRepository(TournamentScheduleSlot);
      const slots = (await repository.createQueryBuilder('slot').where('slot.tournamentId = :tournamentId', { tournamentId }).orderBy('slot.sequence', 'ASC').setLock('pessimistic_write').getMany()).filter((slot) => slot.matchId);
      if (!slots.length) throw new BadRequestException('No hay partidos programados para repartir.');
      const played = await manager.getRepository(TournamentMatch).count({ where: { zone: { tournamentCategory: { tournamentId } }, status: In([MatchStatus.IN_PROGRESS, MatchStatus.PLAYED]) } });
      if (played) throw new BadRequestException('El torneo ya tiene resultados cargados. Cambiá las canchas de los partidos pendientes individualmente.');
      const zones = await manager.getRepository(Zone).find({ where: { tournamentCategory: { tournamentId } }, relations: { venue: true }, order: { tournamentCategoryId: 'ASC', name: 'ASC' } });
      const courts = await manager.getRepository(Court).find({ relations: { venue: true }, order: { id: 'ASC' } });
      const linked = await repository.find({ where: { tournamentId }, relations: { match: true } });
      for (const slot of slots) slot.match = linked.find((item) => item.id === slot.id)?.match ?? null;
      redistributeExistingCourts(slots, zones, courts);
      const undated = slots.filter((slot) => !slot.scheduledAt);
      if (undated.length) {
        const days = this.programDays(tournament);
        distributeProgramCourts(undated, zones, courts, (venue, index) => this.programDate(days, venue.startsAt, venue.matchDurationMinutes, venue.matchesPerDay, index), slots.filter((slot) => slot.scheduledAt));
      }
      // Existing dates remain untouched; fill only dates that were missing.
      const undatedIds = new Set(undated.map((slot) => slot.id));
      for (const slot of slots) await repository.update(slot.id, { courtId: slot.courtId, ...(undatedIds.has(slot.id) ? { scheduledAt: slot.scheduledAt } : {}) });
      return programView(await repository.find({ where: { tournamentId }, relations: programRelations, order: { sequence: 'ASC' } }));
    });
  }

  async scenario(tournamentId: number, config: ProgramScenarioDto, apply = false) {
    const runner = this.slots.manager.connection.createQueryRunner();
    await runner.connect(); await runner.startTransaction();
    try {
      const manager = runner.manager;
      const tournament = await manager.getRepository(Tournament).findOne({ where: { id: tournamentId }, lock: { mode: 'pessimistic_write' } });
      if (!tournament) throw new NotFoundException('Torneo no encontrado');
      const zoneRepo = manager.getRepository(Zone), slotRepo = manager.getRepository(TournamentScheduleSlot);
      const zones = await zoneRepo.find({ where: { tournamentCategory: { tournamentId } }, relations: { venue: true, tournamentCategory: true }, order: { id: 'ASC' } });
      for (const zone of zones) await zoneRepo.findOne({ where: { id: zone.id }, lock: { mode: 'pessimistic_write' } });
      const courts = await manager.getRepository(Court).find({ relations: { venue: true }, order: { id: 'ASC' } });
      await slotRepo.createQueryBuilder('slot').where('slot.tournamentId = :tournamentId', { tournamentId }).setLock('pessimistic_write').getMany();
      const before = await slotRepo.find({ where: { tournamentId }, relations: programRelations, order: { sequence: 'ASC' } });
      if (before.some((slot) => [MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(slot.match?.status as MatchStatus))) throw new BadRequestException('El torneo tiene partidos iniciados o resultados cargados. Editá solamente los partidos pendientes.');
      const { baseVersion: _version, ...settings } = config;
      const baseVersion = createHash('sha256').update(JSON.stringify({ tournament, zones, courts, before, settings })).digest('hex');
      if (apply && config.baseVersion !== baseVersion) throw new BadRequestException('El programa o la configuración cambiaron desde la vista previa. Volvé a calcular el escenario.');
      await this.buildScheduleGrid(manager, tournamentId);
      const slots = (await slotRepo.find({ where: { tournamentId }, relations: programRelations, order: { sequence: 'ASC' } })).filter((slot) => slot.matchId);
      if (slots.some((slot) => [MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(slot.match?.status as MatchStatus))) throw new BadRequestException('El torneo tiene partidos iniciados o resultados cargados. Editá solamente los partidos pendientes.');
      const result = simulateProgram(slots, zones, courts, config);
      if (apply) {
        if (result.warnings.length) throw new BadRequestException('Hay partidos sin horario. Ajustá el escenario antes de aplicarlo.');
        for (const slot of result.slots) await slotRepo.update(slot.id, { courtId: slot.courtId, scheduledAt: slot.scheduledAt });
        for (const rule of config.rules.filter((rule) => rule.stage === 'ZONE')) {
          await zoneRepo.update(rule.zoneId!, { venueId: rule.venueId });
          const zone = zones.find((item) => item.id === rule.zoneId);
          if (zone) { zone.venueId = rule.venueId; await this.rememberZoneVenue(manager, zone); }
        }
        const assignedDays = result.slots.flatMap((slot) => slot.scheduledAt ? [new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(slot.scheduledAt)] : []);
        await manager.getRepository(Tournament).update(tournamentId, { playingDays: [...new Set([...this.programDays(tournament), config.mainDay, config.finalsDay, ...assignedDays])].sort() });
        await runner.commitTransaction();
      } else await runner.rollbackTransaction();
      return { baseVersion, slots: programView(result.slots), warnings: result.warnings, capacityWarnings: result.capacityWarnings };
    } catch (error) { if (runner.isTransactionActive) await runner.rollbackTransaction(); throw error; }
    finally { await runner.release(); }
  }

  private async rememberZoneVenue(manager: EntityManager, zone: Pick<Zone, 'id' | 'tournamentCategoryId' | 'venueId'>) {
    const zones = await manager.getRepository(Zone).find({ where: { tournamentCategoryId: zone.tournamentCategoryId }, order: { name: 'ASC', id: 'ASC' } });
    const zoneIndex = zones.findIndex((item) => item.id === zone.id);
    if (zoneIndex < 0) return;
    await manager.getRepository(TournamentZoneVenuePlan).upsert({
      tournamentCategoryId: zone.tournamentCategoryId, zoneIndex, venueId: zone.venueId, directorAssigned: true,
    }, { conflictPaths: ['tournamentCategoryId', 'zoneIndex'] });
  }

  private programDays(tournament: Tournament) {
    // PostgreSQL date[] may be returned as Date objects depending on the driver parser.
    const isoDay = (day: string | Date) => typeof day === 'string' ? day.slice(0, 10) : day.toISOString().slice(0, 10);
    if (tournament.playingDays.length) return tournament.playingDays.map(isoDay).sort();
    if (!tournament.startsAt) return [];
    const days = [tournament.startsAt];
    if (!tournament.endsAt) return days;
    for (let day = new Date(`${tournament.startsAt}T00:00:00Z`), end = new Date(`${tournament.endsAt}T00:00:00Z`); day < end;) { day.setUTCDate(day.getUTCDate() + 1); days.push(day.toISOString().slice(0, 10)); }
    return days;
  }

  private async linkZoneMatches(manager: EntityManager, zone: Zone, matches: TournamentMatch[]) {
    const repository = manager.getRepository(TournamentScheduleSlot);
    const category = await manager.getRepository(TournamentCategory).findOneBy({ id: zone.tournamentCategoryId });
    if (!category) throw new NotFoundException('Categoria no encontrada');
    const planned = await repository.find({ where: [{ match: { zoneId: zone.id } }, { tournamentCategoryId: zone.tournamentCategoryId, zoneName: zone.name, stage: 'ZONE' }], relations: { court: { venue: true } } });
    const all = await repository.find({ where: { tournamentId: category.tournamentId } });
    let sequence = Math.max(0, ...all.map((slot) => slot.sequence));
    const result = [];
    for (const match of matches) {
      let slot = planned.find((item) => item.matchId === match.id) ?? planned.find((item) => !item.matchId && item.matchOrder === match.matchOrder);
      if (!slot) {
        slot = await repository.save(repository.create({ tournamentId: category.tournamentId, tournamentCategoryId: category.id, zoneName: zone.name, stage: 'ZONE', matchOrder: match.matchOrder, sequence: ++sequence, courtId: null, scheduledAt: match.scheduledAt, matchId: match.id }));
      } else if (!slot.matchId) {
        // Prefer a time explicitly saved on the old real fixture when linking legacy data.
        slot.scheduledAt = match.scheduledAt ?? slot.scheduledAt;
        slot.matchId = match.id;
        await repository.update(slot.id, { matchId: match.id, scheduledAt: slot.scheduledAt });
      }
      if (slot.zoneName !== zone.name) { slot.zoneName = zone.name; await repository.update(slot.id, { zoneName: zone.name }); }
      result.push(matchView(match, slot));
    }
    return result;
  }

  private async ensureKnockoutMatches(manager: EntityManager, tournamentId: number, zones: Zone[]) {
    const repository = manager.getRepository(TournamentMatch);
    const slotsRepository = manager.getRepository(TournamentScheduleSlot);
    const slots = await slotsRepository.find({ where: { tournamentId }, relations: { match: true }, order: { sequence: 'ASC' } });
    const stageOrder = ['QUARTERFINAL', 'SEMIFINAL', 'FINAL'];
    for (const stage of stageOrder) for (const slot of slots.filter((item) => item.stage === stage)) {
      if (slot.matchId) continue;
      const categoryZones = zones.filter((zone) => zone.tournamentCategoryId === slot.tournamentCategoryId).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
      const category = categoryZones[0]?.tournamentCategory ?? await manager.getRepository(TournamentCategory).findOneBy({ id: slot.tournamentCategoryId });
      if (!category) throw new NotFoundException('Categoria no encontrada');
      const sources = slots.filter((item) => item.tournamentCategoryId === slot.tournamentCategoryId && item.stage === (stage === 'SEMIFINAL' ? 'QUARTERFINAL' : 'SEMIFINAL')).sort((a, b) => a.matchOrder - b.matchOrder);
      const firstStage = inferredKnockoutStage(categoryZones.length, category.qualifiersPerZone ?? 2);
      const directQualifiers = stage === firstStage;
      const qualifierPairs = directQualifierPairs(categoryZones, category.qualifiersPerZone ?? 2);
      const qualifiers = qualifierPairs[slot.matchOrder - 1];
      const match = await repository.save(repository.create({ zoneId: null, matchOrder: slot.matchOrder, status: MatchStatus.PENDING,
        scheduledAt: slot.scheduledAt, homeSource: directQualifiers ? ParticipantSource.DIRECT : ParticipantSource.WINNER,
        awaySource: directQualifiers ? ParticipantSource.DIRECT : ParticipantSource.WINNER,
        homeSourceMatchId: directQualifiers ? null : sources[(slot.matchOrder - 1) * 2]?.matchId,
        awaySourceMatchId: directQualifiers ? null : sources[(slot.matchOrder - 1) * 2 + 1]?.matchId,
        homeQualifierZoneId: directQualifiers ? qualifiers?.[0].zoneId : null, homeQualifierRank: directQualifiers ? qualifiers?.[0].rank : null,
        awayQualifierZoneId: directQualifiers ? qualifiers?.[1].zoneId : null, awayQualifierRank: directQualifiers ? qualifiers?.[1].rank : null,
      }));
      slot.matchId = match.id;
      await slotsRepository.update(slot.id, { matchId: match.id });
    }
    // Existing played zones can qualify immediately when upgrading an old tournament.
    for (const zone of zones) await this.resolveQualifiers(manager, zone.id);
  }

  private async resolveQualifiers(manager: EntityManager, zoneId: number) {
    const repository = manager.getRepository(TournamentMatch);
    const games = await repository.find({ where: { zoneId }, order: { matchOrder: 'ASC' } });
    if (!games.length || games.some((game) => game.status !== MatchStatus.PLAYED)) return;
    const entries = await this.orderedEntries(manager, zoneId);
    const rows = standings(entries, games);
    const targets = await repository.find({ where: [{ homeQualifierZoneId: zoneId }, { awayQualifierZoneId: zoneId }] });
    for (const target of targets) {
      const home = target.homeQualifierZoneId === zoneId ? rows[(target.homeQualifierRank ?? 1) - 1]?.registrationId ?? null : target.homeRegistrationId;
      const away = target.awayQualifierZoneId === zoneId ? rows[(target.awayQualifierRank ?? 1) - 1]?.registrationId ?? null : target.awayRegistrationId;
      if (home === target.homeRegistrationId && away === target.awayRegistrationId) continue;
      if ([MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(target.status)) throw new BadRequestException('No se puede cambiar la clasificación: el cruce siguiente ya fue iniciado.');
      target.homeRegistrationId = home; target.awayRegistrationId = away;
      target.status = home && away ? MatchStatus.READY : MatchStatus.PENDING;
      await repository.save(target);
    }
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
    const slot = await this.slots.findOneBy({ id });
    if (!slot) throw new NotFoundException('Turno no encontrado');
    const changes: Partial<TournamentScheduleSlot> = {};
    if (dto.scheduledAt !== undefined) changes.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (dto.courtId !== undefined) {
      if (dto.courtId !== null && !(await this.c.findOneBy({ id: dto.courtId }))) throw new NotFoundException('Cancha no encontrada');
      changes.courtId = dto.courtId;
    }
    await this.slots.update(id, changes);
    return { ...slot, ...changes };
  }

  async fixture(zoneId: number) {
    return this.withLockedZone(zoneId, async (manager, zone) => {
      const category = await manager.getRepository(TournamentCategory).findOneBy({ id: zone.tournamentCategoryId });
      if (!category) throw new NotFoundException('Categoria no encontrada');
      const program = await this.buildScheduleGrid(manager, category.tournamentId);
      return program.filter((slot) => slot.match?.zoneId === zoneId).map((slot) => slot.match!);
    });
  }

  private async fixtureInManager(manager: EntityManager, zone: Zone) {
      const zoneId = zone.id;
      const repository = manager.getRepository(TournamentMatch);
      let existing = await repository.find({ where: { zoneId }, relations: { homeRegistration: true, awayRegistration: true }, order: { matchOrder: 'ASC' } });
      const category = await manager.getRepository(TournamentCategory).findOneBy({ id: zone.tournamentCategoryId });
      if (!category) throw new NotFoundException('Categoria no encontrada');
      // Repeated clicks must not erase scheduled games or results.
      if (existing.length) {
        const definitions = zoneMatchDefinitions(zone.capacity, category.methodology ?? ZoneMethodology.PROVINCE);
        const canReconcile = existing.length === definitions.length
          && existing.every((match) => ![MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(match.status));
        if (canReconcile) {
          const entries = await this.orderedEntries(manager, zoneId);
          const positions = new Map(entries.map((entry) => [entry.seed, entry.registrationId]));
          const matchesByOrder = new Map(existing.map((match) => [match.matchOrder, match]));
          const participant = (definition: ZoneParticipantDefinition) => definition.source === 'DIRECT'
            ? { source: ParticipantSource.DIRECT, registrationId: positions.get(definition.seed) ?? null, sourceMatchId: null }
            : { source: definition.source === 'WINNER' ? ParticipantSource.WINNER : ParticipantSource.LOSER, registrationId: null, sourceMatchId: matchesByOrder.get(definition.matchOrder)?.id ?? null };
          let changed = false;
          for (const definition of definitions) {
            const match = matchesByOrder.get(definition.order);
            if (!match) continue;
            const home = participant(definition.home), away = participant(definition.away);
            const status = home.registrationId && away.registrationId ? MatchStatus.READY : MatchStatus.PENDING;
            const matchChanged = match.homeSource !== home.source || match.homeRegistrationId !== home.registrationId || match.homeSourceMatchId !== home.sourceMatchId
              || match.awaySource !== away.source || match.awayRegistrationId !== away.registrationId || match.awaySourceMatchId !== away.sourceMatchId
              || match.status !== status;
            if (matchChanged) {
              changed = true;
              // Use an explicit column update: these matches were loaded with
              // registration relations and save() would re-persist the stale
              // relation after clearing its foreign key for a dynamic source.
              await repository.update(match.id, {
                homeSource: home.source, homeRegistrationId: home.registrationId, homeSourceMatchId: home.sourceMatchId,
                awaySource: away.source, awayRegistrationId: away.registrationId, awaySourceMatchId: away.sourceMatchId,
                status,
              });
            }
            match.homeSource = home.source;
            match.homeRegistrationId = home.registrationId;
            match.homeSourceMatchId = home.sourceMatchId;
            match.awaySource = away.source;
            match.awayRegistrationId = away.registrationId;
            match.awaySourceMatchId = away.sourceMatchId;
            match.status = status;
          }
          if (changed) {
            existing = await repository.find({ where: { zoneId }, relations: { homeRegistration: true, awayRegistration: true }, order: { matchOrder: 'ASC' } });
          }
        }
        return this.linkZoneMatches(manager, zone, existing);
      }
      if (![3, 4].includes(zone.capacity)) throw new BadRequestException('El cupo de la zona debe ser de 3 o 4 parejas');
      const entries = await this.orderedEntries(manager, zoneId);
      const positions = new Map(entries.map((entry) => [entry.seed, entry.registrationId]));
      const planned = await manager.getRepository(TournamentScheduleSlot).find({ where: { tournamentCategoryId: zone.tournamentCategoryId, zoneName: zone.name, stage: 'ZONE' } });
      const scheduledAt = (order: number) => planned.find((item) => item.matchOrder === order)?.scheduledAt ?? null;
      const created = new Map<number, TournamentMatch>();
      const participant = (definition: ZoneParticipantDefinition) => definition.source === 'DIRECT'
        ? { source: ParticipantSource.DIRECT, registrationId: positions.get(definition.seed) ?? null, sourceMatchId: null }
        : { source: definition.source === 'WINNER' ? ParticipantSource.WINNER : ParticipantSource.LOSER, registrationId: null, sourceMatchId: created.get(definition.matchOrder)?.id ?? null };
      for (const definition of zoneMatchDefinitions(zone.capacity, category.methodology ?? ZoneMethodology.PROVINCE)) {
        const home = participant(definition.home), away = participant(definition.away);
        const match = await repository.save(repository.create({
          zoneId, matchOrder: definition.order, scheduledAt: scheduledAt(definition.order),
          homeSource: home.source, homeRegistrationId: home.registrationId, homeSourceMatchId: home.sourceMatchId,
          awaySource: away.source, awayRegistrationId: away.registrationId, awaySourceMatchId: away.sourceMatchId,
          status: home.registrationId && away.registrationId ? MatchStatus.READY : MatchStatus.PENDING,
        }));
        created.set(definition.order, match);
      }
      return this.linkZoneMatches(manager, zone, await repository.find({ where: { zoneId }, relations: { homeRegistration: true, awayRegistration: true }, order: { matchOrder: 'ASC' } }));
  }

  async schedule(id: number, scheduledAt: string, user: AuthenticatedUser) {
    this.assertDirectorAccess(user);
    const match = await this.matchWithZone(id);
    if (match.zoneId) await this.fixture(match.zoneId);
    const slot = await this.slots.findOneBy({ matchId: id });
    if (!slot) throw new BadRequestException('El partido no tiene programa asociado');
    await this.updateScheduleSlot(slot.id, { scheduledAt });
    return matchView(match, { ...slot, scheduledAt: new Date(scheduledAt) });
  }

  async startMatch(id: number, user: AuthenticatedUser, photo: Express.Multer.File) {
    const slot = await this.slots.findOneBy({ matchId: id });
    if (!slot) throw new NotFoundException('Partido fuera del programa');
    await this.assertMatchAccess(user, id, slot);
    const initial = await this.matchWithZone(id);
    // Starting is idempotent because a mobile connection may lose the response
    // after the photo and state were already committed. A retry confirms the
    // existing start without replacing its original photo.
    if (initial.status === MatchStatus.IN_PROGRESS) return {
      ...initial,
      resultPhotoStoredName: undefined,
      resultPhotoAvailable: Boolean(initial.resultPhotoStoredName),
    };
    if (initial.status !== MatchStatus.READY || !initial.homeRegistrationId || !initial.awayRegistrationId) throw new BadRequestException('El partido todavía no está listo para iniciar.');
    let normalized: Awaited<ReturnType<typeof normalizeMatchPhoto>>;
    try {
      normalized = await normalizeMatchPhoto(photo.buffer);
    } catch {
      throw new BadRequestException('No se pudo procesar la foto. Probá con una imagen JPG, PNG o WebP.');
    }
    const storedName = await storeMatchPhotoBuffer(normalized.data, '.jpg');
    try {
      return await this.withLockedMatch(initial, async (manager) => {
        const repository = manager.getRepository(TournamentMatch);
        const match = await repository.findOneBy({ id });
        if (!match) throw new NotFoundException('Partido no encontrado');
        if (match.status !== MatchStatus.READY || !match.homeRegistrationId || !match.awayRegistrationId) throw new BadRequestException('El partido ya no está disponible para iniciar.');
        match.status = MatchStatus.IN_PROGRESS;
        match.startedById = user.sub;
        match.startedAt = new Date();
        match.resultPhotoStoredName = storedName;
        match.resultPhotoOriginalName = `${photo.originalname.replace(/\.[^.]+$/, '') || `partido-${id}`}.jpg`;
        match.resultPhotoMimeType = 'image/jpeg';
        match.resultPhotoSize = normalized.data.length;
        await repository.save(match);
        return { ...match, resultPhotoStoredName: undefined, resultPhotoAvailable: true };
      });
    } catch (error) {
      await removeMatchResultPhoto(storedName);
      throw error;
    }
  }

  async result(id: number, homeScore: number, awayScore: number, user: AuthenticatedUser, replacementPhoto?: Express.Multer.File) {
    const slot = await this.slots.findOneBy({ matchId: id });
    if (!slot) throw new NotFoundException('Partido fuera del programa');
    await this.assertMatchAccess(user, id, slot);
    const category = slot.tournamentCategory ?? await this.tc.findOneBy({ id: slot.tournamentCategoryId });
    const target = category?.pointsPerSet ?? 25;
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0 || !((homeScore === target && awayScore < target) || (awayScore === target && homeScore < target))) {
      throw new BadRequestException(`El resultado debe tener exactamente un equipo con ${target} tantos y el rival con menos de ${target}.`);
    }
    const initial = await this.matchWithZone(id);
    if (initial.status === MatchStatus.PLAYED) {
      if (initial.homeScore === homeScore && initial.awayScore === awayScore && !replacementPhoto) return initial;
    }
    if (![MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(initial.status)) throw new BadRequestException('Primero cargá la foto inicial para marcar el partido como en juego.');
    if (!initial.resultPhotoStoredName || !initial.homeRegistration || !initial.awayRegistration) throw new BadRequestException('El partido no tiene la foto inicial o sus parejas completas.');
    let decoratedName: string | null = null;
    let replacementSourceName: string | null = null;
    const previousResultName = initial.resultPhotoStoredName;
    const previousSourceName = initial.resultSourcePhotoStoredName;
    try {
      if (replacementPhoto) {
        const normalized = await normalizeMatchPhoto(replacementPhoto.buffer).catch(() => { throw new BadRequestException('No se pudo procesar la foto. Probá con una imagen JPG, PNG o WebP.'); });
        replacementSourceName = await storeMatchPhotoBuffer(normalized.data, '.jpg');
      }
      const sourceName = replacementSourceName ?? initial.resultSourcePhotoStoredName ?? (initial.status === MatchStatus.IN_PROGRESS ? initial.resultPhotoStoredName : null);
      if (!sourceName) throw new BadRequestException('Para corregir este resultado anterior, seleccioná nuevamente la foto original sin la placa.');
      const decorated = await renderMatchResultCard(await readMatchResultPhoto(sourceName), {
        home: { team: teamLabel(initial.homeRegistration), players: playerLabel(initial.homeRegistration), score: homeScore },
        away: { team: teamLabel(initial.awayRegistration), players: playerLabel(initial.awayRegistration), score: awayScore },
      });
      decoratedName = await storeMatchPhotoBuffer(decorated, '.jpg');
      const saved = await this.withLockedMatch(initial, async (manager) => {
        const repository = manager.getRepository(TournamentMatch);
        const match = await repository.findOneBy({ id });
        if (!match) throw new NotFoundException('Partido no encontrado');
        if (![MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(match.status) || !match.homeRegistrationId || !match.awayRegistrationId) throw new BadRequestException('El partido no está disponible para cargar o corregir el resultado.');
        match.homeScore = homeScore;
        match.awayScore = awayScore;
        match.winnerRegistrationId = homeScore > awayScore ? match.homeRegistrationId : match.awayRegistrationId;
        match.status = MatchStatus.PLAYED;
        match.resultSourcePhotoStoredName = sourceName;
        match.resultPhotoStoredName = decoratedName;
        match.resultPhotoOriginalName = `resultado-p${id}.jpg`;
        match.resultPhotoMimeType = 'image/jpeg';
        match.resultPhotoSize = decorated.length;
        match.resultSubmittedById = user.sub;
        match.resultSubmittedAt = new Date();
        await repository.save(match);
        await this.resolveDependents(match, repository);
        if (match.zoneId) await this.resolveQualifiers(manager, match.zoneId);
        return { ...match, resultPhotoStoredName: undefined, resultPhotoAvailable: true };
      });
      if (previousResultName !== sourceName && previousResultName !== decoratedName) await removeMatchResultPhoto(previousResultName);
      if (replacementSourceName && previousSourceName && previousSourceName !== replacementSourceName) await removeMatchResultPhoto(previousSourceName);
      return saved;
    } catch (error) {
      if (decoratedName) await removeMatchResultPhoto(decoratedName);
      if (replacementSourceName) await removeMatchResultPhoto(replacementSourceName);
      throw error;
    }
  }

  async resultPhoto(id: number, user: AuthenticatedUser) {
    await this.assertMatchAccess(user, id);
    const match = await this.m.findOneBy({ id });
    if (!match?.resultPhotoStoredName || !match.resultPhotoMimeType) throw new NotFoundException('El partido no tiene foto de resultado.');
    try {
      return { content: await readMatchResultPhoto(match.resultPhotoStoredName), contentType: match.resultPhotoMimeType, filename: match.resultPhotoOriginalName ?? `resultado-${id}` };
    } catch {
      throw new NotFoundException('No se encontró la foto del partido.');
    }
  }

  async assertZoneAccess(user: AuthenticatedUser, zoneId: number) {
    const zone = await this.z.findOneBy({ id: zoneId });
    if (!zone) throw new NotFoundException('Zona no encontrada');
    if (user.role === UserRole.DIRECTOR) return;
    if (!this.isCourtLeader(user)) throw new ForbiddenException('Este perfil no puede operar canchas.');
    const assigned = await this.slots.createQueryBuilder('slot')
      .innerJoin('slot.match', 'match')
      .innerJoin('slot.court', 'court')
      .innerJoin(VenueLeaderAssignment, 'assignment', 'assignment.venueId = court.venueId AND assignment.userId = :userId', { userId: user.sub })
      .where('match.zoneId = :zoneId', { zoneId })
      .getExists();
    if (!assigned) throw new ForbiddenException('No estas asignado a la sede de esta zona.');
  }

  matches(zoneId: number) { return this.fixture(zoneId); }

  private async withLockedMatch<T>(match: TournamentMatch, action: (manager: EntityManager) => Promise<T>) {
    if (match.zoneId) return this.withLockedZone(match.zoneId, action);
    const slot = await this.slots.findOneBy({ matchId: match.id });
    if (!slot) throw new NotFoundException('Partido fuera del programa');
    return this.slots.manager.transaction(async (manager) => {
      await manager.getRepository(Tournament).findOne({ where: { id: slot.tournamentId }, lock: { mode: 'pessimistic_write' } });
      return action(manager);
    });
  }

  private async matchWithZone(id: number) {
    const match = await this.m.findOne({ where: { id }, relations: { zone: true, homeRegistration: { locality: true }, awayRegistration: { locality: true } } });
    if (!match) throw new NotFoundException('Partido no encontrado');
    return match;
  }

  private assertDirectorAccess(user: AuthenticatedUser) {
    if (user.role === UserRole.DIRECTOR) return;
    throw new ForbiddenException('La asignacion de canchas se define al programar los partidos.');
  }

  private isCourtLeader(user: AuthenticatedUser) {
    return user.role === UserRole.COURT_LEADER || user.role === UserRole.ASSISTANT;
  }

  private async assertMatchAccess(user: AuthenticatedUser, matchId: number, knownSlot?: TournamentScheduleSlot) {
    if (user.role === UserRole.DIRECTOR) return;
    if (!this.isCourtLeader(user)) throw new ForbiddenException('Este perfil no puede cargar resultados.');
    const slot = knownSlot ?? await this.slots.findOneBy({ matchId });
    const court = slot?.courtId ? await this.c.findOneBy({ id: slot.courtId }) : null;
    if (!court || !(await this.assignments.existsBy({ venueId: court.venueId, userId: user.sub }))) {
      throw new ForbiddenException('No estas asignado a la sede de este partido.');
    }
  }

  private async resolveDependents(source: TournamentMatch, repository = this.m) {
    const matches = await repository.find({ where: [{ homeSourceMatchId: source.id }, { awaySourceMatchId: source.id }] });
    for (const match of matches) {
      const participant = (side: 'home' | 'away') => {
        const sourceId = side === 'home' ? match.homeSourceMatchId : match.awaySourceMatchId;
        if (sourceId !== source.id) return side === 'home' ? match.homeRegistrationId : match.awayRegistrationId;
        const sourceType = side === 'home' ? match.homeSource : match.awaySource;
        const loser = source.homeRegistrationId === source.winnerRegistrationId ? source.awayRegistrationId : source.homeRegistrationId;
        return sourceType === ParticipantSource.WINNER ? source.winnerRegistrationId : loser;
      };
      const home = participant('home');
      const away = participant('away');
      if (home === match.homeRegistrationId && away === match.awayRegistrationId) continue;
      if ([MatchStatus.IN_PROGRESS, MatchStatus.PLAYED].includes(match.status)) throw new BadRequestException('No se puede cambiar el ganador: el partido siguiente ya fue iniciado.');
      match.homeRegistrationId = home;
      match.awayRegistrationId = away;
      match.status = home && away ? MatchStatus.READY : MatchStatus.PENDING;
      await repository.save(match);
    }
  }
}

function sameRegistrationRoster(registration: PairRegistration, players: Player[]) {
  const registrationDnis = [registration.playerOneDni, registration.playerTwoDni, registration.playerThreeDni]
    .map((dni) => dni?.trim())
    .filter((dni): dni is string => Boolean(dni))
    .sort();
  const playerDnis = players.map((player) => player.dni.trim()).sort();
  return registrationDnis.length === playerDnis.length && registrationDnis.every((dni, index) => dni === playerDnis[index]);
}

function registrationRoster(players: Player[]) {
  const [one, two, three] = players;
  return {
    playerOneName: one.fullName.trim(),
    playerOneDni: one.dni.trim(),
    playerOneBirthDate: one.birthDate!,
    playerOnePhone: one.phone!.trim(),
    playerOneInstagram: one.instagram,
    playerOneShirtSize: one.shirtSize!,
    playerTwoName: two.fullName.trim(),
    playerTwoDni: two.dni.trim(),
    playerTwoBirthDate: two.birthDate!,
    playerTwoPhone: two.phone!.trim(),
    playerTwoInstagram: two.instagram,
    playerTwoShirtSize: two.shirtSize!,
    playerThreeName: three?.fullName.trim() ?? null,
    playerThreeDni: three?.dni.trim() ?? null,
    playerThreeBirthDate: three?.birthDate ?? null,
    playerThreePhone: three?.phone?.trim() ?? null,
    playerThreeInstagram: three?.instagram ?? null,
    playerThreeShirtSize: three?.shirtSize ?? null,
  };
}

function teamLabel(registration: PairRegistration) {
  return registration.representingText?.trim() || registration.locality?.name || 'Pareja';
}

function playerLabel(registration: PairRegistration) {
  return [registration.playerOneName, registration.playerTwoName, registration.playerThreeName].filter(Boolean).join(' / ');
}

function directQualifierPairs(zones: Zone[], qualifiersPerZone: number) {
  const qualifiers: Array<{ zoneId: number; rank: number }> = [];
  if (qualifiersPerZone === 1) zones.forEach((zone) => qualifiers.push({ zoneId: zone.id, rank: 1 }));
  else for (let index = 0; index < zones.length; index += 2) {
    const first = zones[index], second = zones[index + 1];
    if (!second) break;
    qualifiers.push(
      { zoneId: first.id, rank: 1 }, { zoneId: second.id, rank: 2 },
      { zoneId: second.id, rank: 1 }, { zoneId: first.id, rank: 2 },
    );
  }
  return Array.from({ length: Math.floor(qualifiers.length / 2) }, (_, index) => [qualifiers[index * 2], qualifiers[index * 2 + 1]] as const);
}
