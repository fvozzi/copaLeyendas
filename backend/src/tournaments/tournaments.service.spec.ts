import { describe, expect, it, vi } from 'vitest';
import { TournamentsService } from './tournaments.service';
import { MatchStatus, ParticipantSource } from './tournament.enums';
import { TournamentMatch } from './tournament-match.entity';
import { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import { TournamentCategory } from './tournament-category.entity';
import { Zone } from './zone.entity';
import { ZoneEntry } from './zone-entry.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { RegistrationStatus } from '../registrations/registration.enums';
import { Tournament } from './tournament.entity';
import { Court } from '../courts/court.entity';
import { Venue } from '../courts/venue.entity';
import { TournamentZoneVenuePlan } from './tournament-zone-venue-plan.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { Locality } from '../localities/locality.entity';
import { Player } from '../players/player.entity';
import { ZoneMethodology } from './tournament-methodology';

vi.mock('./tournament.entity', () => ({ Tournament: class Tournament {} }));
vi.mock('./tournament-category.entity', () => ({ TournamentCategory: class TournamentCategory {} }));
vi.mock('./zone.entity', () => ({ Zone: class Zone {} }));
vi.mock('./zone-entry.entity', () => ({ ZoneEntry: class ZoneEntry {} }));
vi.mock('./tournament-match.entity', () => ({ TournamentMatch: class TournamentMatch {} }));
vi.mock('./tournament-schedule-slot.entity', () => ({ TournamentScheduleSlot: class TournamentScheduleSlot {} }));
vi.mock('../registrations/pair-registration.entity', () => ({ PairRegistration: class PairRegistration {} }));
vi.mock('../registrations/registration-access-grant.entity', () => ({ RegistrationAccessGrant: class RegistrationAccessGrant {} }));
vi.mock('../localities/locality.entity', () => ({ Locality: class Locality {} }));
vi.mock('../players/player.entity', () => ({ Player: class Player {} }));
vi.mock('../courts/court.entity', () => ({ Court: class Court {} }));
vi.mock('../courts/venue.entity', () => ({ Venue: class Venue {} }));
vi.mock('../courts/venue-leader-assignment.entity', () => ({ VenueLeaderAssignment: class VenueLeaderAssignment {} }));
vi.mock('./tournament-zone-venue-plan.entity', () => ({ TournamentZoneVenuePlan: class TournamentZoneVenuePlan {} }));
vi.mock('../auth/user.entity', () => ({ UserRole: { DIRECTOR: 'DIRECTOR', COURT_LEADER: 'COURT_LEADER', ASSISTANT: 'ASSISTANT' } }));
vi.mock('./match-result-card', () => ({
  normalizeMatchPhoto: vi.fn(async () => ({ data: Buffer.from('normalized'), info: { width: 800, height: 600 } })),
  renderMatchResultCard: vi.fn(async () => Buffer.from('decorated')),
}));
vi.mock('./match-result-photo-storage', () => ({
  storeMatchPhotoBuffer: vi.fn(async (_buffer: Buffer, extension = '.jpg') => extension === '.jpg' ? 'match.jpg' : `match${extension}`),
  readMatchResultPhoto: vi.fn(async () => Buffer.from('normalized')),
  removeMatchResultPhoto: vi.fn(async () => undefined),
}));

const director = { sub: 1, role: 'DIRECTOR' } as never;
const testPhoto = { buffer: Buffer.from('photo'), originalname: 'inicio.jpg', mimetype: 'image/jpeg', size: 5 } as Express.Multer.File;

it('gives a venue leader access to matches on every court at the assigned venue', async () => {
  const assignedVenue = { id: 10, name: 'Sede Centro', startsAt: '10:00', matchDurationMinutes: 40, matchesPerDay: 16 };
  const otherVenue = { id: 20, name: 'Sede Norte', startsAt: '10:00', matchDurationMinutes: 40, matchesPerDay: 16 };
  const slot = (id: number, courtId: number, venue: typeof assignedVenue) => ({
    id, sequence: id, tournamentId: 1, tournamentCategoryId: 1, stage: 'ZONE', courtId, scheduledAt: null,
    court: { id: courtId, name: `Cancha ${courtId}`, venueId: venue.id, venue },
    matchId: id, match: { id, status: MatchStatus.READY, resultPhotoStoredName: null },
  });
  const allSlots = [slot(1, 101, assignedVenue), slot(2, 102, assignedVenue), slot(3, 201, otherVenue)];
  const tournamentRepository = { findOne: vi.fn(async () => ({ id: 1, name: 'Copa', startsAt: null, endsAt: null })) };
  const slotRepository = { find: vi.fn(async () => allSlots) };
  const courtRepository = { find: vi.fn(async () => allSlots.slice(0, 2).map((item) => item.court)) };
  const assignmentRepository = { find: vi.fn(async () => [{ venueId: assignedVenue.id, userId: 7 }]) };
  const service = new TournamentsService(tournamentRepository as never, {} as never, {} as never, {} as never, {} as never,
    slotRepository as never, courtRepository as never, {} as never, assignmentRepository as never, {} as never);

  const result = await service.operations({ sub: 7, role: 'COURT_LEADER' } as never);

  expect(result.slots.map((item) => item.id)).toEqual([1, 2]);
  expect(result.courts.map((item) => item.id)).toEqual([101, 102]);
  expect(assignmentRepository.find).toHaveBeenCalledWith({ where: { userId: 7 } });
});

async function startFixtureMatch(service: TournamentsService, id: number) {
  await service.startMatch(id, director, testPhoto);
}

function removableZone() {
  const zone = { id: 2, name: 'C', tournamentCategoryId: 8 };
  const zoneMatch = { id: 10, zoneId: 2, status: MatchStatus.PENDING, homeRegistrationId: null, awayRegistrationId: null };
  const knockoutMatch = { id: 20, zoneId: null, status: MatchStatus.PENDING, homeRegistrationId: null as number | null, awayRegistrationId: null, homeQualifierZoneId: 2 };
  const zoneSlot = { id: 100, tournamentCategoryId: 8, stage: 'ZONE', zoneName: 'C', matchId: 10, match: zoneMatch };
  const otherZoneSlot = { id: 101, tournamentCategoryId: 8, stage: 'ZONE', zoneName: 'A', matchId: 11, match: { zoneId: 1 } };
  const knockoutSlot = { id: 200, tournamentCategoryId: 8, stage: 'QUARTERFINAL', matchId: 20, match: knockoutMatch };
  const operations: string[] = [];
  const zoneRepository = { findOne: vi.fn(async () => zone), remove: vi.fn(async () => { operations.push('zone'); }) };
  const entryRepository = { countBy: vi.fn(async () => 0) };
  const matchRepository = { find: vi.fn().mockResolvedValueOnce([zoneMatch]).mockResolvedValueOnce([knockoutMatch]), remove: vi.fn(async () => { operations.push('matches'); }) };
  const slotRepository = { find: vi.fn(async () => [zoneSlot, otherZoneSlot, knockoutSlot]), remove: vi.fn(async () => { operations.push('slots'); }) };
  const repositories = new Map<any, any>([
    [Tournament, { findOne: vi.fn(async () => ({ id: 1 })) }],
    [TournamentCategory, { findOneBy: vi.fn(async () => ({ id: 8, tournamentId: 1 })) }],
    [Zone, zoneRepository], [ZoneEntry, entryRepository], [TournamentMatch, matchRepository], [TournamentScheduleSlot, slotRepository],
  ]);
  const manager = { getRepository: (entity: any) => repositories.get(entity) };
  const transaction = vi.fn(async (work) => work(manager));
  const service = new TournamentsService({} as never, {} as never, { ...zoneRepository, manager: { transaction } } as never,
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  return { service, zone, zoneMatch, knockoutMatch, zoneSlot, otherZoneSlot, knockoutSlot, zoneRepository, entryRepository, matchRepository, slotRepository, operations };
}

it('removes an empty zone and its pending games and knockout schedule without touching other zones', async () => {
  const state = removableZone();
  await expect(state.service.removeZone(2)).resolves.toEqual({ success: true });
  expect(state.slotRepository.remove).toHaveBeenCalledWith([state.zoneSlot, state.knockoutSlot]);
  expect(state.matchRepository.remove.mock.calls).toEqual([[[state.knockoutMatch]], [[state.zoneMatch]]]);
  expect(state.zoneRepository.remove).toHaveBeenCalledWith(state.zone);
  expect(state.operations).toEqual(['slots', 'matches', 'matches', 'zone']);
});

it('does not delete a zone with assigned pairs or progressed knockout matches', async () => {
  const assigned = removableZone();
  assigned.entryRepository.countBy.mockResolvedValue(1);
  await expect(assigned.service.removeZone(2)).rejects.toThrow('parejas asignadas');
  expect(assigned.slotRepository.remove).not.toHaveBeenCalled();
  expect(assigned.zoneRepository.remove).not.toHaveBeenCalled();

  const progressed = removableZone();
  progressed.knockoutMatch.homeRegistrationId = 42;
  await expect(progressed.service.removeZone(2)).rejects.toThrow('cruces de la categoría');
  expect(progressed.slotRepository.remove).not.toHaveBeenCalled();
  expect(progressed.zoneRepository.remove).not.toHaveBeenCalled();
});

it('creates the configured number of zones even before all pairs are confirmed', async () => {
  const zones: any[] = [];
  const zoneRepository = {
    find: vi.fn(async () => zones),
    create: vi.fn((value) => value),
    save: vi.fn(async (values: any[]) => {
      const saved = values.map((value, index) => ({ ...value, id: index + 1 }));
      zones.push(...saved);
      return saved;
    }),
  };
  const entries = { create: vi.fn((value) => value), save: vi.fn(async (value) => value) };
  const registrations = { find: vi.fn(async () => [1, 2, 3, 4, 5, 6].map((id) => ({ id, localityId: id, locality: { name: `Localidad ${id}` } }))) };
  const service = new TournamentsService({} as never,
    { findOne: vi.fn(async () => ({ id: 8, categoryId: 3, zoneSize: 4, zoneCount: 2 })) } as never,
    zoneRepository as never, entries as never, {} as never, {} as never, {} as never,
    { find: vi.fn(async () => [{ id: 7, active: true }]) } as never, {} as never, registrations as never);
  expect(await service.divideZones(8)).toMatchObject([{ name: 'Zona A', capacity: 4 }, { name: 'Zona B', capacity: 4 }]);
  expect(entries.save).toHaveBeenCalledTimes(6);
  expect(entries.create.mock.calls.map(([entry]) => entry.zoneId)).toEqual([1, 2, 1, 2, 1, 2]);
});

it('keeps existing zones if confirmed pairs exceed the configured capacity', async () => {
  const existing = [{ id: 10, tournamentCategoryId: 8 }];
  const zoneRepository = { find: vi.fn(async () => existing), remove: vi.fn(), save: vi.fn() };
  const registrations = { find: vi.fn(async () => Array.from({ length: 9 }, (_, index) => ({ id: index + 1, localityId: index + 1, locality: { name: `Equipo ${index + 1}` } }))) };
  const service = new TournamentsService({} as never,
    { findOne: vi.fn(async () => ({ id: 8, categoryId: 3, zoneSize: 4, zoneCount: 2 })) } as never,
    zoneRepository as never, { count: vi.fn(async () => 0) } as never,
    { count: vi.fn(async () => 0) } as never, {} as never, {} as never, {} as never, {} as never, registrations as never);
  await expect(service.divideZones(8)).rejects.toThrow('solo 8 lugares');
  expect(zoneRepository.remove).not.toHaveBeenCalled();
  expect(zoneRepository.save).not.toHaveBeenCalled();
});

it('adds two semifinals and a final for a category with two zones', async () => {
  const { service, planned, matches, repositories, venue } = setup();
  const zoneRepository = repositories.get(Zone);
  (await repositories.get(TournamentCategory).findOneBy({ id: 8 })).qualifiersPerZone = 2;
  const zones = [
    { id: 1, capacity: 4, tournamentCategoryId: 8, name: 'A', venueId: 1, venue },
    { id: 2, capacity: 4, tournamentCategoryId: 8, name: 'B', venueId: 1, venue },
  ];
  zoneRepository.find.mockResolvedValue(zones);
  zoneRepository.findOne.mockImplementation(async ({ where }: any) => zones.find((zone) => zone.id === where.id));
  vi.spyOn(service as any, 'fixtureInManager').mockResolvedValue([]);
  await service.scheduleGrid(1);
  expect(planned.filter((slot) => slot.stage === 'QUARTERFINAL')).toHaveLength(0);
  expect(planned.filter((slot) => slot.stage === 'SEMIFINAL')).toHaveLength(2);
  expect(planned.filter((slot) => slot.stage === 'FINAL')).toHaveLength(1);
  const semifinals = matches.filter((match) => match.homeQualifierZoneId);
  expect(semifinals).toMatchObject([
    { homeQualifierZoneId: 1, homeQualifierRank: 1, awayQualifierZoneId: 2, awayQualifierRank: 2 },
    { homeQualifierZoneId: 2, homeQualifierRank: 1, awayQualifierZoneId: 1, awayQualifierRank: 2 },
  ]);
  expect(matches.at(-1)).toMatchObject({ homeSourceMatchId: semifinals[0].id, awaySourceMatchId: semifinals[1].id });
});

it('uses the same real games in Program and Zone, preserves scheduling, and reflects assigned pairs and results', async () => {
  const { service, planned, matches, slotRepository, venue } = setup();
  planned.length = 0;
  venue.matchesPerDay = 1;
  const program = await service.scheduleGrid(1);
  expect(program).toHaveLength(4);
  expect(program.map((slot) => slot.courtId)).toEqual([1, 2, 1, 2]);
  expect(program.map((slot) => slot.scheduledAt?.toISOString())).toEqual([
    '2026-11-20T13:00:00.000Z', '2026-11-20T13:00:00.000Z',
    '2026-11-21T13:00:00.000Z', '2026-11-21T13:00:00.000Z',
  ]);
  const ids = program.map((slot) => slot.matchId);
  expect((await service.matches(1)).map((match) => match.id)).toEqual(ids);
  await service.assignPlace(1, 10, 1); await service.assignPlace(1, 20, 3);
  await startFixtureMatch(service, matches[0].id);
  await service.result(matches[0].id, 25, 10, director);
  await service.updateScheduleSlot(program[0].id, { courtId: 2, scheduledAt: '2026-11-22T14:00:00Z' });
  const zone = await service.matches(1);
  expect(zone[0].scheduledAt?.toISOString()).toBe('2026-11-22T14:00:00.000Z');
  expect(zone[0].court?.id).toBe(2);
  const again = await service.scheduleGrid(1);
  expect(again.map((slot) => slot.matchId)).toEqual(ids);
  expect(again[0].match).toMatchObject({ homeRegistrationId: 10, awayRegistrationId: 20, homeScore: 25, awayScore: 10 });
  expect(slotRepository.delete).not.toHaveBeenCalled();
});

it('redistributes existing slots atomically, updating only courts, and rejects tournaments with results', async () => {
  const venue = { id: 1, active: true, matchDurationMinutes: 40 };
  const slots = [1, 2].map((id) => ({ id, matchId: id, sequence: id, stage: 'ZONE', matchOrder: id, zoneName: 'A', tournamentCategoryId: 1, courtId: 1, scheduledAt: new Date(`2026-11-20T${id === 1 ? '13:00' : '13:40'}:00Z`) }));
  const query = { where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), setLock: vi.fn().mockReturnThis(), getMany: vi.fn(async () => slots) };
  const repository = { createQueryBuilder: vi.fn(() => query), update: vi.fn(), find: vi.fn(async () => slots) };
  const matches = { count: vi.fn(async () => 0) };
  const repositories = new Map<any, any>([
    [Tournament, { findOne: vi.fn(async () => ({ id: 1 })) }],
    [TournamentScheduleSlot, repository], [TournamentMatch, matches],
    [Zone, { find: vi.fn(async () => [{ id: 1, name: 'A', tournamentCategoryId: 1, venue }]), findOne: vi.fn() }],
    [Court, { find: vi.fn(async () => [1, 2].map((id) => ({ id, venueId: 1, active: true, venue }))) }],
  ]);
  const manager = { getRepository: (entity: any) => repositories.get(entity) };
  const transaction = vi.fn(async (fn) => fn(manager));
  const service = new TournamentsService({} as never, {} as never, {} as never, {} as never, {} as never, { manager: { transaction } } as never, {} as never, {} as never, {} as never, {} as never);
  const build = vi.spyOn(service as any, 'buildScheduleGrid').mockResolvedValue([]);
  expect(await service.redistributeCourts(1)).toHaveLength(2);
  expect(build).toHaveBeenCalledWith(manager, 1);
  expect(transaction).toHaveBeenCalledOnce();
  expect(repository.update.mock.calls).toEqual([[1, { courtId: 1 }], [2, { courtId: 2 }]]);
  repository.update.mockClear();
  matches.count.mockResolvedValue(1);
  await expect(service.redistributeCourts(1)).rejects.toThrow('resultados cargados');
  expect(repository.update).not.toHaveBeenCalled();
  matches.count.mockResolvedValue(0);
  slots.push({ ...slots[0], id: 3 }, { ...slots[0], id: 4 });
  await expect(service.redistributeCourts(1)).rejects.toThrow('No hay una cancha activa disponible');
  expect(repository.update).not.toHaveBeenCalled();
});

it('saves a zone moved to a single-court venue by moving only pending games that collide', async () => {
  const oldVenue = { id: 1, name: 'Anterior', active: true, matchDurationMinutes: 40, matchesPerDay: 16 };
  const destination = { id: 2, name: 'Gure Echea', active: true, matchDurationMinutes: 40, matchesPerDay: 16 };
  const zone = { id: 1, name: 'C', capacity: 4, venueId: 1, venue: oldVenue, tournamentCategoryId: 8 };
  const start = Date.parse('2026-11-20T13:00:00Z');
  const pending = [1, 2].map((matchOrder) => ({ id: matchOrder, sequence: matchOrder + 6, stage: 'ZONE', matchOrder,
    tournamentCategoryId: 8, zoneName: 'C', courtId: 1, scheduledAt: new Date(start), match: { zoneId: 1, status: MatchStatus.PENDING } }));
  const played = { id: 3, sequence: 1, stage: 'ZONE', matchOrder: 1, tournamentCategoryId: 9, zoneName: 'A',
    courtId: 2, scheduledAt: new Date(start), match: { zoneId: 2, status: MatchStatus.PLAYED } };
  const slots = [...pending, played];
  const slotRepository = {
    createQueryBuilder: vi.fn(() => ({ where: vi.fn().mockReturnThis(), setLock: vi.fn().mockReturnThis(), getMany: vi.fn(async () => slots) })),
    find: vi.fn(async () => slots), update: vi.fn(async () => undefined),
  };
  const zoneRepository = { findOne: vi.fn(async () => zone), find: vi.fn(async () => [zone]), save: vi.fn(async (value) => value) };
  const repositories = new Map<any, any>([
    [Tournament, { findOne: vi.fn(async () => ({ id: 1 })) }],
    [TournamentCategory, { findOneBy: vi.fn(async () => ({ id: 8, tournamentId: 1 })) }],
    [Zone, zoneRepository], [TournamentMatch, { countBy: vi.fn(async () => 0) }],
    [TournamentScheduleSlot, slotRepository], [Venue, { findOneBy: vi.fn(async () => destination) }],
    [Court, { find: vi.fn(async () => [{ id: 1, venueId: 1, active: true, venue: oldVenue }, { id: 2, venueId: 2, active: true, venue: destination }]) }],
    [TournamentZoneVenuePlan, { upsert: vi.fn(async () => undefined) }],
  ]);
  const manager = { getRepository: (entity: any) => repositories.get(entity) };
  const transaction = vi.fn(async (work) => work(manager));
  const service = new TournamentsService({} as never, {} as never, { manager: { transaction } } as never,
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  await service.updateZone(1, { venueId: 2 });
  expect(zoneRepository.save).toHaveBeenCalledWith(expect.objectContaining({ venueId: 2 }));
  expect(slotRepository.update.mock.calls).toEqual([
    [1, { courtId: 2, scheduledAt: new Date(start + 40 * 60_000) }],
    [2, { courtId: 2, scheduledAt: new Date(start + 80 * 60_000) }],
  ]);
  expect(played).toMatchObject({ courtId: 2, scheduledAt: new Date(start) });
});

it('persists a venue choice for a projected zone before generating matches', async () => {
  const venuePlans = { upsert: vi.fn().mockResolvedValue(undefined) };
  const tournamentRepository = { manager: { getRepository: vi.fn((entity) => entity === TournamentZoneVenuePlan ? venuePlans : undefined) } };
  const service = new TournamentsService(tournamentRepository as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const preview = { hasResults: false, venues: [{ id: 4, name: 'GEBA' }, { id: 5, name: 'Ciudad' }], plans: [
    { tournamentCategoryId: 8, zones: [{ name: 'Zona A', venue: { id: 4 } }, { name: 'Zona B', venue: { id: 4 } }] },
    { tournamentCategoryId: 9, zones: [{ name: 'Zona A', venue: { id: 5 } }] },
  ] };
  vi.spyOn(service, 'distributionPreview').mockResolvedValueOnce(preview as never).mockResolvedValueOnce({ ...preview, baseVersion: 'updated' } as never);

  await expect(service.setDistributionVenue(1, { tournamentCategoryId: 8, zoneIndex: 1, venueId: 5 })).resolves.toMatchObject({ baseVersion: 'updated' });
  expect(venuePlans.upsert).toHaveBeenCalledWith([
    { tournamentCategoryId: 8, zoneIndex: 0, venueId: 4, directorAssigned: true },
    { tournamentCategoryId: 8, zoneIndex: 1, venueId: 5, directorAssigned: true },
    { tournamentCategoryId: 9, zoneIndex: 0, venueId: 5, directorAssigned: true },
  ], { conflictPaths: ['tournamentCategoryId', 'zoneIndex'] });
});

it('persists a manual zone layout with room for future confirmed pairs', async () => {
  const category: any = { id: 8, tournamentId: 1, categoryId: 3, zoneSize: 4, zoneCount: null, zoneCapacities: null };
  const categoryRepository = { findOneBy: vi.fn(async () => category), save: vi.fn(async (value) => value) };
  const venuePlans = { delete: vi.fn(async () => undefined) };
  const repositories = new Map<any, any>([
    [Tournament, { findOne: vi.fn(async () => ({ id: 1 })) }],
    [TournamentCategory, categoryRepository],
    [TournamentZoneVenuePlan, venuePlans],
  ]);
  const manager = { getRepository: (entity: any) => repositories.get(entity) };
  const transaction = vi.fn(async (work) => work(manager));
  const service = new TournamentsService({ manager: { transaction } } as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  vi.spyOn(service as any, 'distributionPreviewInManager')
    .mockResolvedValueOnce({ hasResults: false, plans: [{ tournamentCategoryId: 8, registrationCount: 11 }] })
    .mockResolvedValueOnce({ hasResults: false, plans: [{ tournamentCategoryId: 8, registrationCount: 11, capacities: [3, 3, 3, 3] }] });

  await service.setDistributionLayout(1, { tournamentCategoryId: 8, capacities: [3, 3, 3, 3], methodology: ZoneMethodology.ROUND_ROBIN, qualifiersPerZone: 2 });

  expect(category).toMatchObject({ zoneCapacities: [3, 3, 3, 3], zoneCount: 4, zoneSize: 3, methodology: ZoneMethodology.ROUND_ROBIN, qualifiersPerZone: 2 });
  expect(categoryRepository.save).toHaveBeenCalledWith(category);
  expect(venuePlans.delete).toHaveBeenCalledWith(expect.objectContaining({ tournamentCategoryId: 8 }));
});

it('incorporates complete manually created teams but keeps unused-token teams out of zones', async () => {
  const localities = [
    { id: 90, name: 'Comodoro Rivadavia', categoryId: 3, active: true },
    { id: 91, name: 'Invitada sin confirmar', categoryId: 3, active: true },
    { id: 92, name: 'Ya inscripta', categoryId: 3, active: true },
  ];
  const completePlayers = (localityId: number) => [1, 2].map((id) => ({ id: localityId * 10 + id, localityId, fullName: `Jugadora ${id}`, birthDate: '1990-01-01', phone: '5491111111111', shirtSize: 'M' }));
  const repositories = new Map<any, any>([
    [Locality, { find: vi.fn(async () => localities) }],
    [PairRegistration, { find: vi.fn(async () => [{ id: 20, categoryId: 3, localityId: 92 }]) }],
    [RegistrationAccessGrant, { find: vi.fn(async () => [{ id: 30, categoryId: 3, localityId: 91 }]) }],
    [Player, { find: vi.fn(async () => localities.flatMap((locality) => completePlayers(locality.id))) }],
  ]);
  const manager = { getRepository: (entity: any) => repositories.get(entity) };
  const service = new TournamentsService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const resolve = vi.spyOn(service as any, 'resolveZoneRegistration').mockResolvedValue({ id: 77 });

  await (service as any).materializeManualTeams(manager, [{ categoryId: 3 }]);

  expect(resolve).toHaveBeenCalledTimes(1);
  expect(resolve).toHaveBeenCalledWith(manager, 3, undefined, 90);
});

function setup(capacity = 4, methodology = ZoneMethodology.PROVINCE) {
  const venue = { id: 1, active: true, name: 'Club', startsAt: '10:00', matchDurationMinutes: 40, matchesPerDay: 16 };
  const category = { id: 8, tournamentId: 1, categoryId: 3, category: { name: 'Damas A' }, methodology, qualifiersPerZone: 1 };
  const zone = { id: 1, capacity, tournamentCategoryId: 8, name: 'A', venueId: 1, venue, tournamentCategory: category };
  const entries: any[] = [];
  const matches: any[] = [];
  const registration = { id: 10, categoryId: 3, status: RegistrationStatus.CONFIRMED };
  const hydratedRegistration = (id: number | null) => id ? { ...registration, id, playerOneName: `Jugadora ${id} A`, playerTwoName: `Jugadora ${id} B`, locality: { name: `Equipo ${id}` } } : null;
  const hydrateMatch = (match: any) => match ? { ...match, homeRegistration: hydratedRegistration(match.homeRegistrationId), awayRegistration: hydratedRegistration(match.awayRegistrationId) } : null;
  const entryRepository = {
    find: vi.fn(async ({ where }: any = {}) => entries.filter((entry) => where?.zoneId === undefined || (entry.zoneId ?? 1) === where.zoneId).sort((a, b) => a.seed - b.seed || a.id - b.id)),
    findOne: vi.fn(async ({ where }: any) => entries.find((entry) => entry.registrationId === where.registrationId) ?? null),
    save: vi.fn(async (value: any) => {
      if (Array.isArray(value)) return value;
      const saved = { ...value, id: value.id ?? entries.length + 1 };
      const index = entries.findIndex((entry) => entry.id === saved.id);
      if (index < 0) entries.push(saved); else entries[index] = saved;
      return saved;
    }),
  };
  const matchRepository = {
    find: vi.fn(async ({ where }: any) => matches.filter((match) => (Array.isArray(where) ? where : [where]).some((condition) => Object.entries(condition).every(([key, value]) => match[key] === value)))),
    findOne: vi.fn(async ({ where }: any) => hydrateMatch(matches.find((match) => match.id === where.id) ?? null)),
    findOneBy: vi.fn(async ({ id }: any) => matches.find((match) => match.id === id) ?? null),
    create: vi.fn((value) => ({ homeRegistrationId: null, awayRegistrationId: null, homeScore: null, awayScore: null, homeSource: ParticipantSource.DIRECT, awaySource: ParticipantSource.DIRECT, ...value })),
    save: vi.fn(async (value) => {
      const saved = { ...value, id: value.id ?? matches.length + 1 };
      const index = matches.findIndex((match) => match.id === saved.id);
      if (index < 0) matches.push(saved); else matches[index] = saved;
      return saved;
    }),
  };
  const schedule = new Date('2026-11-21T13:00:00Z');
  const courts = [1, 2].map((id) => ({ id, active: true, venueId: 1, venue }));
  const planned: any[] = [{ id: 1, tournamentId: 1, tournamentCategoryId: 8, stage: 'ZONE', zoneName: 'A', sequence: 1, matchOrder: 1, scheduledAt: schedule, courtId: 1, matchId: null }];
  const hydrate = (slot: any) => ({ ...slot, court: courts.find((court) => court.id === slot.courtId) ?? null, tournamentCategory: category, match: matches.find((match) => match.id === slot.matchId) ? { ...matches.find((match) => match.id === slot.matchId), zone } : null });
  const filterSlot = (slot: any, where: any): boolean => Array.isArray(where) ? where.some((condition) => filterSlot(slot, condition)) : Object.entries(where).every(([key, value]) => key === 'match' ? matches.some((match) => match.id === slot.matchId && match.zoneId === (value as any).zoneId) : slot[key] === value);
  const slotRepository = {
    find: vi.fn(async ({ where }: any) => planned.filter((slot) => filterSlot(slot, where)).map(hydrate)),
    findOneBy: vi.fn(async (where: any) => planned.find((slot) => filterSlot(slot, where)) ?? null),
    create: vi.fn((slot) => slot), delete: vi.fn(),
    update: vi.fn(async (id, value) => Object.assign(planned.find((slot) => slot.id === id), value)),
    save: vi.fn(async (value: any): Promise<any> => {
      if (Array.isArray(value)) return Promise.all(value.map((item) => slotRepository.save(item)));
      const saved = { ...value, id: value.id ?? planned.length + 1 }; planned.push(saved); return saved;
    }),
  };
  const tournamentRepository = { findOne: vi.fn(async () => ({ id: 1 })), findOneBy: vi.fn(async () => ({ id: 1, playingDays: ['2026-11-20', '2026-11-21'] })) };
  const repositories = new Map<any, any>([
    [Zone, { findOne: vi.fn(async () => zone), find: vi.fn(async () => [zone]) }],
    [TournamentCategory, { findOne: vi.fn(async () => category), findOneBy: vi.fn(async () => category) }],
    [Tournament, tournamentRepository], [Court, { find: vi.fn(async () => courts), findOneBy: vi.fn(async ({ id }) => courts.find((court) => court.id === id)) }],
    [PairRegistration, { findOneBy: vi.fn(async ({ id }) => ({ ...registration, id })) }],
    [ZoneEntry, entryRepository], [TournamentMatch, matchRepository],
    [TournamentScheduleSlot, slotRepository],
  ]);
  const manager = { getRepository: (entity: any) => repositories.get(entity) };
  const zoneRepository = { manager: { transaction: vi.fn(async (fn) => fn(manager)) } };
  const service = new TournamentsService(tournamentRepository as never, repositories.get(TournamentCategory) as never, zoneRepository as never, {} as never, matchRepository as never, { ...slotRepository, manager: zoneRepository.manager } as never, repositories.get(Court) as never, {} as never, {} as never, {} as never);
  return { service, entries, matches, matchRepository, registration, schedule, entryRepository, planned, slotRepository, venue, repositories };
}

describe('fixtures with unassigned places', () => {
  it('creates a confirmed administrative participant when an active team has players but no registration', async () => {
    const { service, entries, repositories } = setup();
    const locality = { id: 99, name: 'Comodoro Rivadavia', active: true, categoryId: 3 };
    const players = [
      { id: 1, localityId: 99, fullName: 'Ana Sur', dni: '30111222', birthDate: '1970-01-01', phone: '5491111111111', instagram: null, shirtSize: 'M' },
      { id: 2, localityId: 99, fullName: 'Bea Sur', dni: '30222333', birthDate: '1971-01-01', phone: '5491122222222', instagram: null, shirtSize: 'L' },
    ];
    const savedRegistrations: any[] = [];
    const registrationRepository = {
      findOneBy: vi.fn(async () => null), find: vi.fn(async () => []), count: vi.fn(async () => 1),
      create: vi.fn((value) => value), save: vi.fn(async (value) => { const saved = { ...value, id: 77 }; savedRegistrations.push(saved); return saved; }),
    };
    const grantRepository = { save: vi.fn(async (value) => ({ ...value, id: 55 })), update: vi.fn() };
    repositories.set(PairRegistration, registrationRepository);
    repositories.set(RegistrationAccessGrant, grantRepository);
    repositories.set(Locality, { findOneBy: vi.fn(async () => locality) });
    repositories.set(Player, { find: vi.fn(async () => players) });

    await service.assignPlace(1, undefined, 1, locality.id);

    expect(savedRegistrations[0]).toMatchObject({ id: 77, localityId: 99, categoryId: 3, status: RegistrationStatus.CONFIRMED, playerOneDni: '30111222', playerTwoDni: '30222333', feeWaived: true });
    expect(entries).toContainEqual(expect.objectContaining({ zoneId: 1, registrationId: 77, seed: 1 }));
    expect(grantRepository.save).toHaveBeenCalledWith(expect.objectContaining({ localityId: 99, feeWaived: true }));
  });

  it('reuses the old confirmed registration when the same roster now belongs to a new active team', async () => {
    const { service, entries, repositories } = setup();
    const locality = { id: 99, name: 'Comodoro Rivadavia', active: true, categoryId: 3 };
    const players = [
      { id: 1, localityId: 99, fullName: 'Ana Sur', dni: '30111222', birthDate: '1970-01-01', phone: '5491111111111', instagram: null, shirtSize: 'M' },
      { id: 2, localityId: 99, fullName: 'Bea Sur', dni: '30222333', birthDate: '1971-01-01', phone: '5491122222222', instagram: null, shirtSize: 'L' },
    ];
    const oldRegistration: any = { id: 42, accessGrantId: 7, localityId: 5, categoryId: 3, status: RegistrationStatus.CONFIRMED, playerOneDni: '30111222', playerTwoDni: '30222333', playerThreeDni: null };
    const registrationRepository = {
      findOneBy: vi.fn(async () => oldRegistration), find: vi.fn(async () => [oldRegistration]), count: vi.fn(async () => 1),
      save: vi.fn(async (value) => value), create: vi.fn((value) => value),
    };
    const grantRepository = { save: vi.fn(), update: vi.fn(async () => undefined) };
    repositories.set(PairRegistration, registrationRepository);
    repositories.set(RegistrationAccessGrant, grantRepository);
    repositories.set(Locality, { findOneBy: vi.fn(async () => locality) });
    repositories.set(Player, { find: vi.fn(async () => players) });

    await service.assignPlace(1, oldRegistration.id, 1, locality.id);

    expect(oldRegistration).toMatchObject({ localityId: 99, representingText: 'Comodoro Rivadavia', playerOneName: 'Ana Sur', playerTwoName: 'Bea Sur' });
    expect(entries).toContainEqual(expect.objectContaining({ registrationId: 42, seed: 1 }));
    expect(grantRepository.save).not.toHaveBeenCalled();
    expect(grantRepository.update).toHaveBeenCalledWith(7, expect.objectContaining({ localityId: 99 }));
  });

  it.each([3, 4])('generates an empty %i-pair fixture with schedules and pending games', async (capacity) => {
    const { service, matches, schedule } = setup(capacity);
    await service.fixture(1);
    expect(matches).toHaveLength(capacity);
    expect(matches.every((match) => match.status === MatchStatus.PENDING && !match.homeRegistrationId && !match.awayRegistrationId)).toBe(true);
    expect(matches[0].scheduledAt).toEqual(schedule);
    if (capacity === 4) {
      expect(matches[2]).toMatchObject({ homeSource: ParticipantSource.WINNER, homeSourceMatchId: matches[0].id, awaySource: ParticipantSource.LOSER, awaySourceMatchId: matches[1].id });
    }
  });

  it('fills arbitrary places and replacements without recreating matches or changing schedules', async () => {
    const { service, matches, entries, schedule } = setup();
    await service.fixture(1);
    const ids = matches.map((match) => match.id);
    await service.assignPlace(1, 20, 3);
    expect(matches[0]).toMatchObject({ homeRegistrationId: null, awayRegistrationId: 20, status: MatchStatus.PENDING });
    await service.assignPlace(1, 10, 1);
    expect(matches[0]).toMatchObject({ homeRegistrationId: 10, awayRegistrationId: 20, status: MatchStatus.READY });
    await service.assignPlace(1, 30, 1);
    expect(entries).toHaveLength(2);
    expect(matches[0]).toMatchObject({ homeRegistrationId: 30, awayRegistrationId: 20, scheduledAt: schedule });
    expect(matches.map((match) => match.id)).toEqual(ids);
    expect(matches[2].homeRegistrationId).toBeNull();
  });

  it('updates all round-robin matches when a three-pair place is filled', async () => {
    const { service, matches } = setup(3, ZoneMethodology.ROUND_ROBIN);
    await service.fixture(1);
    await service.assignPlace(1, 30, 3);
    expect(matches[1].awayRegistrationId).toBe(30);
    expect(matches[2].awayRegistrationId).toBe(30);
  });

  it('swaps pairs between zones and updates both pending fixtures without changing the games', async () => {
    const { service, entries, matches } = setup();
    entries.push(
      { id: 1, zoneId: 1, seed: 1, registrationId: 10 },
      { id: 2, zoneId: 1, seed: 3, registrationId: 30 },
      { id: 3, zoneId: 2, seed: 1, registrationId: 20 },
      { id: 4, zoneId: 2, seed: 3, registrationId: 40 },
    );
    matches.push(
      { id: 1, zoneId: 1, matchOrder: 1, homeSource: ParticipantSource.DIRECT, awaySource: ParticipantSource.DIRECT, homeRegistrationId: 10, awayRegistrationId: 30, status: MatchStatus.READY },
      { id: 2, zoneId: 2, matchOrder: 1, homeSource: ParticipantSource.DIRECT, awaySource: ParticipantSource.DIRECT, homeRegistrationId: 20, awayRegistrationId: 40, status: MatchStatus.READY },
    );

    await service.assignPlace(1, 20, 1);

    expect(entries.find((entry) => entry.zoneId === 1 && entry.seed === 1)?.registrationId).toBe(20);
    expect(entries.find((entry) => entry.zoneId === 2 && entry.seed === 1)?.registrationId).toBe(10);
    expect(matches.find((match) => match.zoneId === 1)).toMatchObject({ id: 1, homeRegistrationId: 20, awayRegistrationId: 30, status: MatchStatus.READY });
    expect(matches.find((match) => match.zoneId === 2)).toMatchObject({ id: 2, homeRegistrationId: 10, awayRegistrationId: 40, status: MatchStatus.READY });
  });

  it('reorders pairs inside a zone and updates the fixture without recreating its matches', async () => {
    const { service, entries, matches } = setup();
    await service.fixture(1);
    for (let seed = 1; seed <= 4; seed++) await service.assignPlace(1, seed * 10, seed);
    const matchIds = matches.map((match) => match.id);

    await service.assignPlace(1, 10, 4);

    expect(entries.find((entry) => entry.seed === 1)?.registrationId).toBe(40);
    expect(entries.find((entry) => entry.seed === 4)?.registrationId).toBe(10);
    expect(matches.map((match) => match.id)).toEqual(matchIds);
    expect(matches[0]).toMatchObject({ homeRegistrationId: 40, awayRegistrationId: 30, status: MatchStatus.READY });
    expect(matches[1]).toMatchObject({ homeRegistrationId: 20, awayRegistrationId: 10, status: MatchStatus.READY });
  });

  it('resolves winners and losers after filling the previously empty fixture', async () => {
    const { service, matches } = setup();
    await service.fixture(1);
    for (let seed = 1; seed <= 4; seed++) await service.assignPlace(1, seed * 10, seed);
    await startFixtureMatch(service, matches[0].id);
    await service.result(matches[0].id, 25, 10, director);
    expect(matches[2]).toMatchObject({ homeRegistrationId: 10, awayRegistrationId: null, status: MatchStatus.PENDING });
    await startFixtureMatch(service, matches[1].id);
    await service.result(matches[1].id, 25, 10, director);
    expect(matches[2]).toMatchObject({ homeRegistrationId: 10, awayRegistrationId: 40, status: MatchStatus.READY });
    expect(matches[3]).toMatchObject({ homeRegistrationId: 20, awayRegistrationId: 30, status: MatchStatus.READY });
  });

  it('treats a repeated start as success when the first mobile response was lost', async () => {
    const { service, matches } = setup();
    await service.fixture(1);
    await service.assignPlace(1, 10, 1);
    await service.assignPlace(1, 30, 3);

    await expect(service.startMatch(matches[0].id, director, testPhoto)).resolves.toMatchObject({ status: MatchStatus.IN_PROGRESS });
    await expect(service.startMatch(matches[0].id, director, testPhoto)).resolves.toMatchObject({
      status: MatchStatus.IN_PROGRESS,
      resultPhotoAvailable: true,
    });
    expect(matches[0]).toMatchObject({ status: MatchStatus.IN_PROGRESS, resultPhotoStoredName: 'match.jpg' });
  });

  it('preserves the clean source photo and regenerates the plate when correcting a result', async () => {
    const { service, matches } = setup();
    await service.fixture(1);
    for (let seed = 1; seed <= 4; seed++) await service.assignPlace(1, seed * 10, seed);
    await startFixtureMatch(service, matches[0].id);
    await service.result(matches[0].id, 25, 10, director);

    expect(matches[0]).toMatchObject({ status: MatchStatus.PLAYED, homeScore: 25, awayScore: 10, resultSourcePhotoStoredName: 'match.jpg' });

    await service.result(matches[0].id, 12, 25, director);

    expect(matches[0]).toMatchObject({ status: MatchStatus.PLAYED, homeScore: 12, awayScore: 25, winnerRegistrationId: 30, resultSourcePhotoStoredName: 'match.jpg' });
    expect(matches[2]).toMatchObject({ homeRegistrationId: 30, status: MatchStatus.PENDING });
  });

  it('requires a clean replacement photo to correct a legacy result', async () => {
    const { service, matches } = setup();
    await service.fixture(1);
    for (let seed = 1; seed <= 4; seed++) await service.assignPlace(1, seed * 10, seed);
    await startFixtureMatch(service, matches[0].id);
    await service.result(matches[0].id, 25, 10, director);
    matches[0].resultSourcePhotoStoredName = null;

    await expect(service.result(matches[0].id, 12, 25, director)).rejects.toThrow('seleccioná nuevamente la foto original');
    await service.result(matches[0].id, 12, 25, director, testPhoto);

    expect(matches[0]).toMatchObject({ homeScore: 12, awayScore: 25, resultSourcePhotoStoredName: 'match.jpg' });
  });

  it('regenerates the plate when replacing the photo without changing the score', async () => {
    const { service, matches, matchRepository } = setup();
    await service.fixture(1);
    for (let seed = 1; seed <= 4; seed++) await service.assignPlace(1, seed * 10, seed);
    await startFixtureMatch(service, matches[0].id);
    await service.result(matches[0].id, 25, 10, director);
    matchRepository.save.mockClear();

    await service.result(matches[0].id, 25, 10, director, testPhoto);

    expect(matchRepository.save).toHaveBeenCalled();
    expect(matches[0]).toMatchObject({ homeScore: 25, awayScore: 10, resultSourcePhotoStoredName: 'match.jpg' });
  });

  it('requires exactly one team to reach the configured 25 points', async () => {
    const { service, matches } = setup();
    await service.fixture(1);
    await service.assignPlace(1, 10, 1); await service.assignPlace(1, 20, 3);
    await expect(service.result(matches[0].id, 24, 10, director)).rejects.toThrow('exactamente un equipo con 25');
    await expect(service.result(matches[0].id, 25, 25, director)).rejects.toThrow('exactamente un equipo con 25');
    await expect(service.result(matches[0].id, 25, -1, director)).rejects.toThrow('exactamente un equipo con 25');
    expect(matches[0].status).toBe(MatchStatus.READY);
  });

  it('preserves existing results on repeated generation and blocks replacing played fixtures', async () => {
    const { service, matches, matchRepository } = setup();
    await service.fixture(1);
    matches[0].status = MatchStatus.PLAYED;
    matches[0].homeScore = 25;
    matchRepository.save.mockClear();
    await service.fixture(1);
    expect(matchRepository.save).not.toHaveBeenCalled();
    await expect(service.assignPlace(1, 30, 1)).rejects.toThrow('resultados');
    expect(matches[0].homeScore).toBe(25);
  });

  it('rejects wrong categories, unconfirmed pairs and invalid places', async () => {
    const { service, registration } = setup();
    await service.assignPlace(1, 10, 1);
    await expect(service.assignPlace(1, 20, 5)).rejects.toThrow('lugar');
    registration.categoryId = 9;
    await expect(service.assignPlace(1, 20, 2)).rejects.toThrow('confirmada');
    registration.categoryId = 3;
    registration.status = RegistrationStatus.RECEIVED;
    await expect(service.assignPlace(1, 20, 2)).rejects.toThrow('confirmada');
  });

  it('preserves the order of legacy seed-zero assignments', async () => {
    const { service, entries, matches } = setup();
    entries.push({ id: 1, seed: 0, registrationId: 10 }, { id: 2, seed: 0, registrationId: 20 }, { id: 3, seed: 0, registrationId: 30 });
    await service.fixture(1);
    expect(matches[0]).toMatchObject({ homeRegistrationId: 10, awayRegistrationId: 30 });
    expect(entries.map((entry) => entry.seed)).toEqual([1, 2, 3]);
  });

  it('generates every direct pairing with the all-against-all methodology', async () => {
    const { service, matches } = setup(4, ZoneMethodology.ROUND_ROBIN);
    await service.fixture(1);
    for (let seed = 1; seed <= 4; seed++) await service.assignPlace(1, seed * 10, seed);
    expect(matches).toHaveLength(6);
    expect(matches.map((match) => [match.homeRegistrationId, match.awayRegistrationId])).toEqual([
      [10, 20], [10, 30], [10, 40], [20, 30], [20, 40], [30, 40],
    ]);
    expect(matches.every((match) => match.status === MatchStatus.READY)).toBe(true);
  });
});
