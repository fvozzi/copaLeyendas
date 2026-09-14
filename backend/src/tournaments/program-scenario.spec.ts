import { expect, it } from 'vitest';
import { simulateProgram } from './program-scenario';
import type { ProgramScenarioDto } from './program-scenario.dto';
import type { Court } from '../courts/court.entity';
import type { Zone } from './zone.entity';
import type { TournamentScheduleSlot } from './tournament-schedule-slot.entity';

function fixture() {
  const venue = { id: 1, name: 'Ciudad', active: true, startsAt: '10:00', matchDurationMinutes: 40, matchesPerDay: 30 };
  const courts = [1, 2].map((id) => ({ id, venueId: 1, active: true, venue })) as Court[];
  const zones = [1, 2].map((id) => ({ id, name: 'A', capacity: 3, venueId: 1, tournamentCategoryId: id, venue })) as Zone[];
  const slots = zones.flatMap((zone) => [1, 2, 3].map((order) => ({ id: zone.id * 10 + order, matchId: zone.id * 10 + order, sequence: zone.id * 10 + order, matchOrder: order, stage: 'ZONE', tournamentCategoryId: zone.tournamentCategoryId, zoneName: zone.name, scheduledAt: new Date('2020-01-01'), courtId: 2, match: { id: zone.id * 10 + order, zoneId: zone.id, status: 'PENDING' } }))) as TournamentScheduleSlot[];
  const config: ProgramScenarioDto = { mainDay: '2026-11-20', finalsDay: '2026-11-21', interleaveCategories: true, rules: zones.map((zone) => ({ categoryId: zone.tournamentCategoryId, stage: 'ZONE', zoneId: zone.id, venueId: 1, courtId: 1, day: 'MAIN' })) };
  return { courts, zones, slots, config };
}
it('interleaves categories on a shared court, preserves inputs, and supports contiguous categories', () => {
  const { slots, zones, courts, config } = fixture();
  const before = structuredClone(slots);
  const chronological = (values: TournamentScheduleSlot[]) => [...values].sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime()).map((s) => s.tournamentCategoryId);
  const result = simulateProgram(slots, zones, courts, config);
  expect(result.warnings).toEqual([]);
  expect(chronological(result.slots)).toEqual([1, 2, 1, 2, 1, 2]);
  expect(chronological(simulateProgram(slots, zones, courts, { ...config, interleaveCategories: false }).slots)).toEqual([1, 1, 1, 2, 2, 2]);
  expect(slots).toEqual(before);
});
it('respects finals day, venue, court and real source matches; reports impossible chronology', () => {
  const { slots, zones, courts, config } = fixture();
  courts.push({ ...courts[0], id: 3, venueId: 2, venue: { ...courts[0].venue, id: 2, name: 'GEBA' } });
  slots.push({ ...slots[0], id: 100, matchId: 100, sequence: 100, stage: 'FINAL', match: { ...slots[0].match!, zoneId: null, homeSourceMatchId: 13, awaySourceMatchId: 23 } });
  config.rules.push({ categoryId: 1, stage: 'FINAL', venueId: 2, courtId: 3, day: 'FINALS' });
  const result = simulateProgram(slots, zones, courts, config);
  const final = result.slots.find((s) => s.stage === 'FINAL')!;
  expect(final.courtId).toBe(3);
  expect(final.scheduledAt?.toISOString()).toBe('2026-11-21T13:00:00.000Z');
  const impossible = { ...config, rules: config.rules.map((r) => ({ ...r, day: r.stage === 'ZONE' ? 'FINALS' as const : 'MAIN' as const })) };
  expect(simulateProgram(slots, zones, courts, impossible).warnings).toHaveLength(1);
});
it('reports capacity exhaustion and rejects mismatched courts and missing rules', () => {
  const { slots, zones, courts, config } = fixture();
  courts.forEach((court) => { court.venue = { ...court.venue, matchesPerDay: 1 }; });
  const result = simulateProgram(slots, zones, courts, config);
  expect(result.warnings).toHaveLength(5);
  expect(() => simulateProgram(slots, zones, courts, { ...config, rules: config.rules.slice(1) })).toThrow('Falta configurar');
  expect(() => simulateProgram(slots, zones, courts, { ...config, rules: config.rules.map((r) => ({ ...r, courtId: 99 })) })).toThrow('cancha activa');
});

it('allows different venues and days for individual quarterfinals in the same category', () => {
  const { slots, zones, courts, config } = fixture();
  courts.push({ ...courts[0], id: 3, venueId: 2, venue: { ...courts[0].venue, id: 2, name: 'GEBA' } });
  for (const matchOrder of [1, 2]) {
    slots.push({ ...slots[0], id: 100 + matchOrder, matchId: 100 + matchOrder, sequence: 100 + matchOrder, stage: 'QUARTERFINAL', matchOrder, match: { ...slots[0].match!, zoneId: null, homeQualifierZoneId: 1, awayQualifierZoneId: 2 } });
    config.rules.push({ categoryId: 1, stage: 'QUARTERFINAL', matchOrder, venueId: matchOrder, courtId: matchOrder === 1 ? 1 : 3, day: matchOrder === 1 ? 'MAIN' : 'FINALS' });
  }
  const result = simulateProgram(slots, zones, courts, config);
  expect(result.warnings).toEqual([]);
  expect(result.slots.filter((s) => s.stage === 'QUARTERFINAL').map((s) => [s.court?.venueId, s.scheduledAt?.toISOString().slice(0, 10)])).toEqual([[1, '2026-11-20'], [2, '2026-11-21']]);
});
