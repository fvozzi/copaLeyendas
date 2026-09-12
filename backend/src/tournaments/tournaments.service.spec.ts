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

it('distributes a new schedule across courts and preserves an existing schedule on later reads', async () => {
  const venue = { id: 1, active: true, startsAt: '10:00', matchDurationMinutes: 40, matchesPerDay: 1 };
  const zone = { id: 1, name: 'A', capacity: 4, tournamentCategoryId: 1, venueId: 1, venue };
  let stored: any[] = [];
  const repository = {
    find: vi.fn(async () => stored),
    create: vi.fn((value) => value),
    delete: vi.fn(async () => { stored = []; }),
    save: vi.fn(async (values) => { stored = values; }),
  };
  const service = new TournamentsService(
    { findOneBy: vi.fn(async () => ({ id: 1, playingDays: ['2026-11-20', '2026-11-21'] })) } as never,
    {} as never, { find: vi.fn(async () => [zone]) } as never, {} as never, {} as never,
    repository as never,
    { find: vi.fn(async () => [{ id: 1, venueId: 1, active: true }, { id: 2, venueId: 1, active: true }]) } as never,
    {} as never, {} as never, {} as never,
  );
  await service.scheduleGrid(1);
  expect(stored.map((slot) => slot.courtId)).toEqual([1, 2, 1, 2]);
  expect(stored.map((slot) => slot.scheduledAt.toISOString())).toEqual([
    '2026-11-20T13:00:00.000Z', '2026-11-20T13:00:00.000Z',
    '2026-11-21T13:00:00.000Z', '2026-11-21T13:00:00.000Z',
  ]);
  stored[0].courtId = 2;
  await service.scheduleGrid(1);
  expect(stored[0].courtId).toBe(2);
  expect(repository.save).toHaveBeenCalledTimes(1);
  expect(repository.delete).toHaveBeenCalledTimes(1);
});

function setup(capacity = 4) {
  const zone = { id: 1, capacity, tournamentCategoryId: 8, name: 'A' };
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
    create: vi.fn((value) => ({ homeRegistrationId: null, awayRegistrationId: null, homeScore: null, awayScore: null, ...value })),
    save: vi.fn(async (value) => {
      const saved = { ...value, id: value.id ?? matches.length + 1 };
      const index = matches.findIndex((match) => match.id === saved.id);
      if (index < 0) matches.push(saved); else matches[index] = saved;
      return saved;
    }),
  };
  const schedule = new Date('2026-11-21T13:00:00Z');
  const repositories = new Map<any, any>([
    [Zone, { findOne: vi.fn(async () => zone) }],
    [TournamentCategory, { findOne: vi.fn(async () => ({ categoryId: 3 })) }],
    [PairRegistration, { findOneBy: vi.fn(async ({ id }) => ({ ...registration, id })) }],
    [ZoneEntry, entryRepository], [TournamentMatch, matchRepository],
    [TournamentScheduleSlot, { find: vi.fn(async () => [{ matchOrder: 1, scheduledAt: schedule }]) }],
  ]);
  const manager = { getRepository: (entity: any) => repositories.get(entity) };
  const zoneRepository = { manager: { transaction: vi.fn(async (fn) => fn(manager)) } };
  const service = new TournamentsService({} as never, {} as never, zoneRepository as never, {} as never, matchRepository as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  return { service, entries, matches, matchRepository, registration, schedule, entryRepository };
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
