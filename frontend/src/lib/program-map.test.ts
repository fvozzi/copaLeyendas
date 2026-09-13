import { expect, it } from 'vitest';
import { categoryGraph, mapZonePairs, venueColor } from './program-map';
import { programMapFixture } from '../test/program-map-fixture';

it('connects each zone qualifier and each winning match to the real next match', () => {
  const { tournament, slots } = programMapFixture();
  const graph = categoryGraph(tournament.zones.filter((zone) => zone.tournamentCategoryId === 1), slots.filter((slot) => slot.tournamentCategoryId === 1));
  expect(graph.nodes).toHaveLength(11);
  expect(graph.edges).toHaveLength(14);
  const quarter = slots.find((slot) => slot.stage === 'QUARTERFINAL')!;
  expect(graph.edges.filter((edge) => edge.to === `match-${quarter.matchId}`)).toEqual([
    { from: 'zone-1', to: `match-${quarter.matchId}`, side: 'home', rank: 1 },
    { from: 'zone-2', to: `match-${quarter.matchId}`, side: 'away', rank: 2 },
  ]);
});
it('filters venue zones while preserving their real paths to the final and stable colors', () => {
  const { tournament, slots } = programMapFixture();
  const graph = categoryGraph(tournament.zones, slots, 1);
  expect(graph.nodes.filter((node) => node.zone).map((node) => node.zone?.id)).toEqual([1, 5, 3, 7]);
  expect(graph.nodes.filter((node) => node.slot?.stage === 'FINAL')).toHaveLength(2);
  expect(graph.edges.every((edge) => graph.nodes.some((node) => node.id === edge.from) && graph.nodes.some((node) => node.id === edge.to))).toBe(true);
  expect(venueColor(1)).not.toBe(venueColor(2));
});

it('keeps pair positions and ignores later winners for zones of three and four', () => {
  const { tournament, slots } = programMapFixture();
  const zone = tournament.zones[0];
  const pair = { id: 9, playerOneName: 'Ana', playerTwoName: 'Bea' } as NonNullable<typeof slots[0]['match']>['homeRegistration'];
  slots[1].match!.awayRegistration = pair;
  slots[2].match!.homeRegistration = pair;
  expect(mapZonePairs(zone, slots).map((place) => [place.seed, place.registration?.id ?? null])).toEqual([[1, null], [2, null], [3, null], [4, 9]]);
  expect(mapZonePairs({ ...zone, capacity: 3 }, slots).map((place) => [place.seed, place.registration?.id ?? null])).toEqual([[1, null], [2, null], [3, 9]]);
});
