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

it('balances sequential games across available courts even when both are free at the next start', () => {
  const { slots, zones, courts, config } = fixture();
  const rules = config.rules.slice(0, 1).map((rule) => ({ ...rule, courtId: null }));
  const result = simulateProgram(slots.filter((slot) => slot.tournamentCategoryId === 1), zones, courts, { ...config, rules });
  expect(result.warnings).toEqual([]);
  expect(result.slots.map((slot) => slot.courtId)).toEqual([1, 2, 1]);
  const inactive = courts.map((court) => ({ ...court, active: court.id === 1 }));
  expect(simulateProgram(slots.filter((slot) => slot.tournamentCategoryId === 1), zones, inactive, { ...config, rules }).slots.every((slot) => slot.courtId === 1)).toBe(true);
});

it('uses both courts in parallel for unrestricted zones while honoring a fixed court', () => {
  const { slots, zones, courts, config } = fixture();
  const result = simulateProgram(slots, zones, courts, { ...config, rules: config.rules.map((rule) => ({ ...rule, courtId: null })) });
  expect(result.warnings).toEqual([]);
  expect(courts.map((court) => result.slots.filter((slot) => slot.courtId === court.id).length)).toEqual([3, 3]);
  expect(result.slots.find((slot) => slot.sequence === 11)!.scheduledAt).toEqual(result.slots.find((slot) => slot.sequence === 21)!.scheduledAt);
  expect(simulateProgram(slots, zones, courts, config).slots.every((slot) => slot.courtId === 1)).toBe(true);
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
it('extends beyond planned capacity and rejects mismatched courts and missing rules', () => {
  const { slots, zones, courts, config } = fixture();
  courts.forEach((court) => { court.venue = { ...court.venue, matchesPerDay: 1 }; });
  const result = simulateProgram(slots, zones, courts, config);
  expect(result.warnings).toHaveLength(0);
  expect(result.capacityWarnings).toHaveLength(5);
  expect(result.slots.every((slot) => slot.scheduledAt && slot.courtId)).toBe(true);
  expect(() => simulateProgram(slots, zones, courts, { ...config, rules: config.rules.slice(1) })).toThrow('Falta configurar');
  expect(() => simulateProgram(slots, zones, courts, { ...config, rules: config.rules.map((r) => ({ ...r, courtId: 99 })) })).toThrow('cancha activa');
});

it('schedules both semifinals before a final even when only one source is linked', () => {
  const { slots, zones, courts, config } = fixture();
  courts.forEach((court) => { court.venue = { ...court.venue, matchesPerDay: 1 }; });
  for (const order of [1, 2]) {
    slots.push({ ...slots[0], id: 100 + order, matchId: 100 + order, sequence: 100 + order, stage: 'SEMIFINAL', matchOrder: order, match: { ...slots[0].match!, zoneId: null, homeSourceMatchId: order === 1 ? 13 : 23 } });
    config.rules.push({ categoryId: 1, stage: 'SEMIFINAL', matchOrder: order, venueId: 1, courtId: 1, day: 'MAIN' });
  }
  slots.push({ ...slots[0], id: 103, matchId: 103, sequence: 103, stage: 'FINAL', matchOrder: 1, match: { ...slots[0].match!, zoneId: null, homeSourceMatchId: 101 } });
  config.rules.push({ categoryId: 1, stage: 'FINAL', venueId: 1, courtId: 1, day: 'MAIN' });
  config.overrides = [{ sequence: 103, courtId: 1, scheduledAt: '2026-11-20T20:00:00Z' }];
  const result = simulateProgram(slots, zones, courts, config);
  expect(result.warnings).toEqual([]);
  const final = result.slots.find((s) => s.sequence === 103)!;
  for (const semi of result.slots.filter((s) => s.stage === 'SEMIFINAL')) expect(semi.scheduledAt!.getTime() + 40 * 60_000).toBeLessThanOrEqual(final.scheduledAt!.getTime());
  expect(result.slots.every((s) => s.scheduledAt && s.courtId)).toBe(true);
  expect(result.capacityWarnings.length).toBeGreaterThan(0);
  // An impossible fixed final must remain invalid, never leapfrog an unscheduled semi.
  config.overrides[0].scheduledAt = '2026-11-20T13:00:00Z';
  const invalid = simulateProgram(slots, zones, courts, config);
  expect(invalid.slots.find((s) => s.stage === 'FINAL')!.scheduledAt).toBeNull();
  expect(invalid.warnings.find((w) => w.sequence === 103)?.message).toContain('P101');
});

it('keeps generating overnight when the planned turns run out, without overlapping games', () => {
  const { slots, zones, courts, config } = fixture();
  courts.forEach((court) => { court.venue = { ...court.venue, startsAt: '23:20', matchesPerDay: 1 }; });
  const result = simulateProgram(slots, zones, courts, config);
  expect(result.warnings).toEqual([]);
  expect(result.capacityWarnings).toHaveLength(5);
  const times = result.slots.map((s) => s.scheduledAt!.getTime()).sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBe(40 * 60_000);
  expect(new Date(times[5]).toISOString()).toBe('2026-11-21T05:40:00.000Z');
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

it('reserves manual times before automatic allocation and honors them outside automatic turns', () => {
  const { slots, zones, courts, config } = fixture();
  courts.forEach((court) => { court.venue = { ...court.venue, matchesPerDay: 1 }; });
  config.overrides = slots.map((slot, index) => ({ sequence: slot.sequence, courtId: 1, scheduledAt: new Date(Date.parse('2026-11-20T14:00:00Z') + index * 40 * 60_000).toISOString() }));
  const result = simulateProgram(slots, zones, courts, config);
  expect(result.warnings).toEqual([]);
  expect(result.slots.map((slot) => slot.scheduledAt?.toISOString())).toEqual(config.overrides.map((o) => o.scheduledAt));
});

it('schedules predecessors before a fixed manual match and keeps its court free', () => {
  const { slots, zones, courts, config } = fixture();
  config.overrides = [{ sequence: 13, courtId: 1, scheduledAt: '2026-11-20T14:20:00Z' }];
  const result = simulateProgram(slots, zones, courts, config);
  expect(result.warnings).toEqual([]);
  expect(result.slots.find((s) => s.sequence === 13)?.scheduledAt?.toISOString()).toBe('2026-11-20T14:20:00.000Z');
  expect(result.slots.find((s) => s.sequence === 12)?.scheduledAt?.toISOString()).toBe('2026-11-20T13:40:00.000Z');
  expect(new Set(result.slots.map((s) => `${s.courtId}:${s.scheduledAt}`)).size).toBe(6);
});

it('identifies colliding manual matches and names the missing predecessors', () => {
  const { slots, zones, courts, config } = fixture();
  config.overrides = [11, 21].map((sequence) => ({ sequence, courtId: 1, scheduledAt: '2026-11-20T13:00:00Z' }));
  const result = simulateProgram(slots, zones, courts, config);
  expect(result.warnings.find((w) => w.sequence === 11)?.message).toContain('superpone con P21');
  expect(result.warnings.find((w) => w.sequence === 12)?.message).toContain('P11');
  expect(result.slots.find((s) => s.sequence === 11)?.courtId).toBe(1);
  expect(result.slots.find((s) => s.sequence === 11)?.scheduledAt).toBeNull();
});
