import { describe, expect, it } from 'vitest';
import { distributeProgramCourts, redistributeExistingCourts } from './program-courts';
import type { Court } from '../courts/court.entity';
import type { Venue } from '../courts/venue.entity';
import type { Zone } from './zone.entity';
import type { TournamentScheduleSlot } from './tournament-schedule-slot.entity';

const venue = { id: 1, active: true, matchDurationMinutes: 40 } as Venue;
const zones = [{ id: 1, name: 'A', capacity: 4, tournamentCategoryId: 1, venueId: 1, venue }] as Zone[];
const courts = [{ id: 1, venueId: 1, active: true }, { id: 2, venueId: 1, active: true }, { id: 3, venueId: 1, active: false }, { id: 4, venueId: 2, active: true }] as Court[];
const start = Date.parse('2026-11-20T13:00:00Z');
const dateAt = (_venue: Venue, index: number) => new Date(start + index * 40 * 60_000);
const games = () => [1, 2, 3, 4].map((matchOrder) => ({ matchOrder, zoneName: 'A', tournamentCategoryId: 1, stage: 'ZONE' } as TournamentScheduleSlot));

describe('existing program redistribution', () => {
  it('balances 38 existing games across two courts without changing dates or IDs', () => {
    const slots = Array.from({ length: 38 }, (_, index) => ({ ...games()[0], id: index + 1, sequence: index + 1, courtId: 1, scheduledAt: dateAt(venue, index) }));
    const before = slots.map(({ courtId: _courtId, ...slot }) => slot);
    redistributeExistingCourts(slots, zones, courts);
    expect(slots.filter((slot) => slot.courtId === 1)).toHaveLength(19);
    expect(slots.filter((slot) => slot.courtId === 2)).toHaveLength(19);
    expect(slots.map(({ courtId: _courtId, ...slot }) => slot)).toEqual(before);
  });
  it('keeps a manually selected venue for knockouts and avoids overlapping games on the same court', () => {
    const otherVenue = { ...venue, id: 2 };
    const slots = [0, 1].map((index) => ({ ...games()[0], stage: 'QUARTERFINAL', sequence: index + 1, courtId: 4, scheduledAt: new Date(start + index * 10 * 60_000) }));
    redistributeExistingCourts(slots, zones, [...courts.map((court) => ({ ...court, venue: court.venueId === 2 ? otherVenue : venue })), { id: 5, active: true, venueId: 2, venue: otherVenue } as Court]);
    expect(slots.map((slot) => slot.courtId)).toEqual([4, 5]);
  });
  it('moves a renamed zone to its current venue instead of retaining its old court venue', () => {
    const destination = { ...venue, id: 2, name: 'Gure Echea' };
    const slots = [0, 1].map((index) => ({ ...games()[0], sequence: index + 1, courtId: 1, scheduledAt: dateAt(venue, index), match: { zoneId: 1 } } as TournamentScheduleSlot));
    redistributeExistingCourts(slots, [{ ...zones[0], name: 'Renamed', venueId: 2, venue: destination }], courts.map((court) => ({ ...court, venue: court.venueId === 2 ? destination : venue })));
    expect(slots.map((slot) => slot.courtId)).toEqual([4, 4]);
    expect(slots.map((slot) => slot.scheduledAt)).toEqual([dateAt(venue, 0), dateAt(venue, 1)]);
  });
  it('reserves other zones and played games when moving only pending games', () => {
    const slots = [{ ...games()[0], sequence: 2, courtId: 4, scheduledAt: new Date(start) }];
    const fixed = [{ ...games()[0], id: 50, courtId: 1, scheduledAt: new Date(start) }];
    const available = courts.map((court) => ({ ...court, venue }));
    redistributeExistingCourts(slots, zones, available, fixed);
    expect(slots[0].courtId).toBe(2);
    expect(fixed[0].courtId).toBe(1);
    expect(() => redistributeExistingCourts(slots, zones, available.filter((court) => court.id !== 2), fixed)).toThrow('No hay una cancha activa disponible');
  });
  it('rejects a schedule with insufficient active courts at a given time', () => {
    const slots = [1, 2, 3].map((sequence) => ({ ...games()[0], sequence, courtId: 1, scheduledAt: new Date(start) }));
    expect(() => redistributeExistingCourts(slots, zones, courts)).toThrow('No hay una cancha activa disponible');
  });
  it('moves a zone to one active court, keeping played reservations and extending past planned turns', () => {
    const destination = { ...venue, matchesPerDay: 2 } as Venue;
    const oneCourt = [{ id: 1, venueId: 1, active: true, venue: destination }] as Court[];
    const fixed = [{ ...games()[0], id: 90, sequence: 1, courtId: 1, scheduledAt: new Date(start), match: { zoneId: 2 } } as TournamentScheduleSlot];
    const slots = [1, 2, 3, 4].map((matchOrder) => ({ ...games()[0], id: matchOrder, sequence: matchOrder + 1,
      matchOrder, courtId: 4, scheduledAt: new Date(start + (matchOrder > 2 ? 40 * 60_000 : 0)), match: { zoneId: 1 } } as TournamentScheduleSlot));
    redistributeExistingCourts(slots, [{ ...zones[0], venue: destination }], oneCourt, fixed, true);
    expect(slots.map((slot) => slot.courtId)).toEqual([1, 1, 1, 1]);
    expect(slots.map((slot) => slot.scheduledAt?.getTime())).toEqual([1, 2, 3, 4].map(index => start + index * 40 * 60_000));
    expect(fixed[0].scheduledAt?.getTime()).toBe(start);
  });
  it('still blocks a venue without active courts when moving a zone', () => {
    const slot = { ...games()[0], sequence: 8, scheduledAt: new Date(start) };
    expect(() => redistributeExistingCourts([slot], zones, [], [], true)).toThrow('No hay canchas activas');
  });
});

describe('program court allocation', () => {
  it('fills new games around existing reservations, including partial time overlaps', () => {
    const fixed = [{ ...games()[0], tournamentCategoryId: 2, courtId: 1, scheduledAt: new Date(start + 600_000) }, { ...games()[0], tournamentCategoryId: 2, courtId: 2, scheduledAt: new Date(start) }];
    const before = structuredClone(fixed);
    const slots = games().slice(0, 3);
    distributeProgramCourts(slots, [{ ...zones[0], capacity: 3 }], courts.map((court) => ({ ...court, venue })), dateAt, fixed);
    expect(slots.map((slot) => slot.scheduledAt?.getTime())).toEqual([1, 2, 3].map((i) => start + i * 2_400_000));
    expect(slots[0].courtId).toBe(2);
    expect(fixed).toEqual(before);
  });
  it('uses both active courts concurrently and waits for both opening games before dependent games', () => {
    const slots = games();
    distributeProgramCourts(slots, zones, courts, dateAt);
    expect(slots.map((slot) => slot.courtId)).toEqual([1, 2, 1, 2]);
    expect(slots.map((slot) => slot.scheduledAt?.getTime())).toEqual([start, start, start + 2_400_000, start + 2_400_000]);
  });
  it('never double books a court and rolls each court over to the next playing day', () => {
    const slots = games();
    distributeProgramCourts(slots, zones, courts, (_venue, index) => new Date(start + Math.floor(index / 1) * 86_400_000));
    expect(slots.map((slot) => slot.scheduledAt?.getTime())).toEqual([start, start, start + 86_400_000, start + 86_400_000]);
    expect(new Set(slots.map((slot) => `${slot.courtId}:${slot.scheduledAt?.toISOString()}`)).size).toBe(4);
  });
  it('leaves games without dates when capacity is exhausted, including later rounds', () => {
    const slots = [...games(), { stage: 'QUARTERFINAL', tournamentCategoryId: 1, matchOrder: 1 } as TournamentScheduleSlot];
    distributeProgramCourts(slots, zones, courts, (_venue, index) => index === 0 ? new Date(start) : null);
    expect(slots.map((slot) => Boolean(slot.scheduledAt))).toEqual([true, true, false, false, false]);
  });
  it('waits for the previous knockout stage and serializes a three-pair zone', () => {
    const slots = [...games(), ...['QUARTERFINAL', 'SEMIFINAL', 'FINAL'].map((stage) => ({ stage, tournamentCategoryId: 1, matchOrder: 1 } as TournamentScheduleSlot))];
    distributeProgramCourts(slots, [{ ...zones[0], capacity: 3 }], courts, dateAt);
    expect(slots.map((slot) => slot.scheduledAt?.getTime())).toEqual([0, 1, 2, 3, 4, 5, 6].map((index) => start + index * 2_400_000));
  });
  it('does not schedule games in a venue without an active court', () => {
    const slots = games();
    distributeProgramCourts(slots, zones, [], dateAt);
    expect(slots.every((slot) => slot.courtId === null && slot.scheduledAt === null)).toBe(true);
  });
});
