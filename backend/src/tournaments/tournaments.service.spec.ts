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

vi.mock('./tournament.entity', () => ({ Tournament: class Tournament {} }));
vi.mock('./tournament-category.entity', () => ({ TournamentCategory: class TournamentCategory {} }));
vi.mock('./zone.entity', () => ({ Zone: class Zone {} }));
vi.mock('./zone-entry.entity', () => ({ ZoneEntry: class ZoneEntry {} }));
vi.mock('./tournament-match.entity', () => ({ TournamentMatch: class TournamentMatch {} }));
vi.mock('./tournament-schedule-slot.entity', () => ({ TournamentScheduleSlot: class TournamentScheduleSlot {} }));
vi.mock('../registrations/pair-registration.entity', () => ({ PairRegistration: class PairRegistration {} }));
vi.mock('../courts/court.entity', () => ({ Court: class Court {} }));
vi.mock('../courts/venue.entity', () => ({ Venue: class Venue {} }));
vi.mock('../courts/court-assistant-assignment.entity', () => ({ CourtAssistantAssignment: class CourtAssistantAssignment {} }));
vi.mock('../auth/user.entity', () => ({ UserRole: { DIRECTOR: 'DIRECTOR', ASSISTANT: 'ASSISTANT' } }));

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
  await service.assignPlace(1, 10, 1); await service.assignPlace(1, 20, 2);
  await service.result(matches[0].id, 25, 10, { role: 'DIRECTOR' } as never);
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
  const zoneRepository = { findOne: vi.fn(async () => zone), save: vi.fn(async (value) => value) };
  const repositories = new Map<any, any>([
    [Tournament, { findOne: vi.fn(async () => ({ id: 1 })) }],
    [TournamentCategory, { findOneBy: vi.fn(async () => ({ id: 8, tournamentId: 1 })) }],
    [Zone, zoneRepository], [TournamentMatch, { countBy: vi.fn(async () => 0) }],
    [TournamentScheduleSlot, slotRepository], [Venue, { findOneBy: vi.fn(async () => destination) }],
    [Court, { find: vi.fn(async () => [{ id: 1, venueId: 1, active: true, venue: oldVenue }, { id: 2, venueId: 2, active: true, venue: destination }]) }],
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

function setup(capacity = 4) {
  const venue = { id: 1, active: true, name: 'Club', startsAt: '10:00', matchDurationMinutes: 40, matchesPerDay: 16 };
  const zone = { id: 1, capacity, tournamentCategoryId: 8, name: 'A', venueId: 1, venue };
  const category = { id: 8, tournamentId: 1, categoryId: 3, category: { name: 'Damas A' } };
  const entries: any[] = [];
  const matches: any[] = [];
  const registration = { id: 10, categoryId: 3, status: RegistrationStatus.CONFIRMED };
  const entryRepository = {
    find: vi.fn(async () => [...entries].sort((a, b) => a.seed - b.seed || a.id - b.id)),
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
    find: vi.fn(async ({ where }: any) => Array.isArray(where) ? matches.filter((match) => where.some((condition) => Object.entries(condition).every(([key, value]) => match[key] === value))) : matches),
    findOne: vi.fn(async ({ where }: any) => matches.find((match) => match.id === where.id) ?? null),
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
  const service = new TournamentsService(tournamentRepository as never, {} as never, zoneRepository as never, {} as never, matchRepository as never, { ...slotRepository, manager: zoneRepository.manager } as never, repositories.get(Court) as never, {} as never, {} as never, {} as never);
  return { service, entries, matches, matchRepository, registration, schedule, entryRepository, planned, slotRepository, venue };
}

describe('fixtures with unassigned places', () => {
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
    await service.assignPlace(1, 20, 2);
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
    const { service, matches } = setup(3);
    await service.fixture(1);
    await service.assignPlace(1, 30, 3);
    expect(matches[1].awayRegistrationId).toBe(30);
    expect(matches[2].awayRegistrationId).toBe(30);
  });

  it('resolves winners and losers after filling the previously empty fixture', async () => {
    const { service, matches } = setup();
    await service.fixture(1);
    for (let seed = 1; seed <= 4; seed++) await service.assignPlace(1, seed * 10, seed);
    const director = { role: 'DIRECTOR' } as never;
    await service.result(matches[0].id, 25, 10, director);
    expect(matches[2]).toMatchObject({ homeRegistrationId: 10, awayRegistrationId: null, status: MatchStatus.PENDING });
    await service.result(matches[1].id, 25, 10, director);
    expect(matches[2]).toMatchObject({ homeRegistrationId: 10, awayRegistrationId: 40, status: MatchStatus.READY });
    expect(matches[3]).toMatchObject({ homeRegistrationId: 30, awayRegistrationId: 20, status: MatchStatus.READY });
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

  it('rejects duplicate assignments, wrong categories, unconfirmed pairs and invalid places', async () => {
    const { service, registration } = setup();
    await service.assignPlace(1, 10, 1);
    await expect(service.assignPlace(1, 10, 2)).rejects.toThrow('ya esta asignada');
    await expect(service.assignPlace(1, 20, 5)).rejects.toThrow('lugar');
    registration.categoryId = 9;
    await expect(service.assignPlace(1, 20, 2)).rejects.toThrow('confirmada');
    registration.categoryId = 3;
    registration.status = RegistrationStatus.RECEIVED;
    await expect(service.assignPlace(1, 20, 2)).rejects.toThrow('confirmada');
  });

  it('preserves the order of legacy seed-zero assignments', async () => {
    const { service, entries, matches } = setup();
    entries.push({ id: 1, seed: 0, registrationId: 10 }, { id: 2, seed: 0, registrationId: 20 });
    await service.fixture(1);
    expect(matches[0]).toMatchObject({ homeRegistrationId: 10, awayRegistrationId: 20 });
    expect(entries.map((entry) => entry.seed)).toEqual([1, 2]);
  });
});
