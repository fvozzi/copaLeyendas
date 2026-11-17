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

  it('delays the decisive all-against-all games in zones of four', () => {
    expect(zoneMatchDefinitions(4, ZoneMethodology.ROUND_ROBIN)).toEqual([
      { order: 1, home: { source: 'DIRECT', seed: 1 }, away: { source: 'DIRECT', seed: 2 } },
      { order: 2, home: { source: 'DIRECT', seed: 3 }, away: { source: 'DIRECT', seed: 4 } },
      { order: 3, home: { source: 'WINNER', matchOrder: 1 }, away: { source: 'LOSER', matchOrder: 2 } },
      { order: 4, home: { source: 'LOSER', matchOrder: 1 }, away: { source: 'WINNER', matchOrder: 2 } },
      { order: 5, home: { source: 'LOSER', matchOrder: 1 }, away: { source: 'LOSER', matchOrder: 2 } },
      { order: 6, home: { source: 'WINNER', matchOrder: 1 }, away: { source: 'WINNER', matchOrder: 2 } },
    ]);
  });

  it('still produces each pairing exactly once regardless of the first two winners', () => {
    const definitions = zoneMatchDefinitions(4, ZoneMethodology.ROUND_ROBIN);
    for (const winnerOne of [1, 2]) for (const winnerTwo of [3, 4]) {
      const result = new Map([[1, { winner: winnerOne, loser: winnerOne === 1 ? 2 : 1 }], [2, { winner: winnerTwo, loser: winnerTwo === 3 ? 4 : 3 }]]);
      const participant = (side: (typeof definitions)[number]['home']) => side.source === 'DIRECT' ? side.seed : result.get(side.matchOrder)![side.source === 'WINNER' ? 'winner' : 'loser'];
      const pairings = definitions.map((match) => [participant(match.home), participant(match.away)].sort().join('-')).sort();
      expect(pairings).toEqual(['1-2', '1-3', '1-4', '2-3', '2-4', '3-4']);
    }
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
