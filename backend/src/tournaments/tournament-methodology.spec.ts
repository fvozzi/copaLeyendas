import { describe, expect, it } from 'vitest';
import { inferredKnockoutStage, zoneMatchDefinitions, ZoneMethodology } from './tournament-methodology';

describe('zoneMatchDefinitions', () => {
  it('uses the Province sequence for zones of four', () => {
    expect(zoneMatchDefinitions(4, ZoneMethodology.PROVINCE)).toEqual([
      { order: 1, home: { source: 'DIRECT', seed: 1 }, away: { source: 'DIRECT', seed: 3 } },
      { order: 2, home: { source: 'DIRECT', seed: 2 }, away: { source: 'DIRECT', seed: 4 } },
      { order: 3, home: { source: 'WINNER', matchOrder: 1 }, away: { source: 'LOSER', matchOrder: 2 } },
      { order: 4, home: { source: 'WINNER', matchOrder: 2 }, away: { source: 'LOSER', matchOrder: 1 } },
    ]);
  });

  it('uses the Province triangular sequence for zones of three', () => {
    expect(zoneMatchDefinitions(3, ZoneMethodology.PROVINCE)).toEqual([
      { order: 1, home: { source: 'DIRECT', seed: 1 }, away: { source: 'DIRECT', seed: 2 } },
      { order: 2, home: { source: 'WINNER', matchOrder: 1 }, away: { source: 'DIRECT', seed: 3 } },
      { order: 3, home: { source: 'LOSER', matchOrder: 1 }, away: { source: 'DIRECT', seed: 3 } },
    ]);
  });

  it('creates every pairing once for all against all', () => {
    expect(zoneMatchDefinitions(4, ZoneMethodology.ROUND_ROBIN).map((match) => [match.home, match.away])).toEqual([
      [{ source: 'DIRECT', seed: 1 }, { source: 'DIRECT', seed: 2 }],
      [{ source: 'DIRECT', seed: 1 }, { source: 'DIRECT', seed: 3 }],
      [{ source: 'DIRECT', seed: 1 }, { source: 'DIRECT', seed: 4 }],
      [{ source: 'DIRECT', seed: 2 }, { source: 'DIRECT', seed: 3 }],
      [{ source: 'DIRECT', seed: 2 }, { source: 'DIRECT', seed: 4 }],
      [{ source: 'DIRECT', seed: 3 }, { source: 'DIRECT', seed: 4 }],
    ]);
  });
});

describe('inferredKnockoutStage', () => {
  it.each([[4, 2, 'QUARTERFINAL'], [2, 2, 'SEMIFINAL'], [1, 2, 'FINAL']] as const)('infers the stage for %i zones and %i qualifiers', (zones, qualifiers, expected) => {
    expect(inferredKnockoutStage(zones, qualifiers)).toBe(expected);
  });

  it('rejects a total that cannot form a direct elimination bracket', () => {
    expect(inferredKnockoutStage(3, 2)).toBeNull();
  });
});
