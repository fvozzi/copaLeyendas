import { describe, expect, it } from 'vitest';
import { distributeProgramCourts } from './program-courts';
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

describe('program court allocation', () => {
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
