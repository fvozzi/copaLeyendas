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

it('uses the official zone entries when round-robin games repeat pairs', () => {
  const { tournament, slots } = programMapFixture();
  const registrations = [1, 2, 3, 4].map((id) => ({ id, playerOneName: `Jugadora ${id}A`, playerTwoName: `Jugadora ${id}B`, locality: { id, name: `Equipo ${id}` } })) as NonNullable<(typeof tournament.zones)[number]['entries']>[number]['registration'][];
  const zone = { ...tournament.zones[0], entries: registrations.map((registration, index) => ({ id: index + 1, seed: index + 1, registration })) };
  const games = slots.filter((slot) => slot.match?.zoneId === zone.id);
  games[0].match!.homeRegistration = registrations[0] as never;
  games[0].match!.awayRegistration = registrations[1] as never;
  games[1].match!.homeRegistration = registrations[0] as never;
  games[1].match!.awayRegistration = registrations[2] as never;

  expect(mapZonePairs(zone, games).map((place) => place.registration?.id)).toEqual([1, 2, 3, 4]);
});
