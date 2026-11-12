import { describe, expect, it } from 'vitest';
import { calculateZoneCapacities, planTournamentDistribution } from './tournament-distribution';

describe('calculateZoneCapacities', () => {
  it.each([
    [16, [4, 4, 4, 4]],
    [12, [3, 3, 3, 3]],
    [8, [4, 4]],
    [9, [3, 3, 3]],
    [10, [4, 3, 3]],
    [11, [4, 4, 3]],
    [13, [4, 3, 3, 3]],
    [14, [4, 4, 3, 3]],
    [15, [4, 4, 4, 3]],
  ])('distributes %i registrations as %j', (total, expected) => {
    expect(calculateZoneCapacities(total as number)).toEqual(expected);
  });

  it('rejects totals that cannot fill zones exactly', () => {
    expect(() => calculateZoneCapacities(5)).toThrow('zonas de 3 o 4');
  });
});

describe('planTournamentDistribution', () => {
  it('keeps a locality in one venue and separates its pairs into different zones', () => {
    const registrations = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      localityId: index < 2 ? 1 : index,
      localityName: index < 2 ? 'Lavalleja' : `Localidad ${index}`,
      label: `Pareja ${index + 1}`,
    }));
    const [plan] = planTournamentDistribution([{ id: 3, name: 'Damas A', registrations }], [{ id: 1, name: 'Sede Norte' }, { id: 2, name: 'Sede Sur' }], new Map([['3:0', 1], ['3:1', 1]]));
    expect(plan.capacities).toEqual([4, 4]);
    const localityZones = plan.zones.filter((zone) => zone.registrations.some((registration) => registration.localityId === 1));
    expect(localityZones.map((zone) => zone.registrations.filter((registration) => registration.localityId === 1).length)).toEqual([1, 1]);
    expect(new Set(localityZones.map((zone) => zone.venue?.id)).size).toBe(1);
  });

  it('prefers the same venue for a locality appearing in another category', () => {
    const categories = [1, 2].map((categoryId) => ({ id: categoryId, name: `Categoria ${categoryId}`, registrations: Array.from({ length: 6 }, (_, index) => ({ id: categoryId * 10 + index, localityId: index === 0 ? 7 : categoryId * 100 + index, localityName: index === 0 ? 'Rocha' : `Localidad ${categoryId}-${index}`, label: `Pareja ${index}` })) }));
    const plans = planTournamentDistribution(categories, [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], new Map([['1:0', 1], ['1:1', 2], ['2:0', 1], ['2:1', 2]]));
    const localityVenue = (plan: typeof plans[number]) => plan.zones.find((zone) => zone.registrations.some((registration) => registration.localityId === 7))?.venue?.id;
    expect(localityVenue(plans[1])).toBe(localityVenue(plans[0]));
  });

  it('honors venue choices made before generating zones and keeps them by zone position when counts change', () => {
    const registrations = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, localityId: index + 1, localityName: `Equipo ${index + 1}`, label: `Pareja ${index + 1}` }));
    const venues = [{ id: 1, name: 'Norte' }, { id: 2, name: 'Sur' }];
    const choices = new Map([['3:0', 2], ['3:1', 1], ['3:2', 2]]);
    const [threeZones] = planTournamentDistribution([{ id: 3, name: 'Damas A', registrations }], venues, choices);
    expect(threeZones.zones.map((zone) => zone.venue?.id)).toEqual([2, 1, 2]);
    expect(threeZones.zones.slice(0, 2).map((zone) => zone.venueAssignment)).toEqual(['MANUAL', 'MANUAL']);

    const [twoZones] = planTournamentDistribution([{ id: 3, name: 'Damas A', registrations: registrations.slice(0, 8) }], venues, choices);
    expect(twoZones.zones.map((zone) => zone.venue?.id)).toEqual([2, 1]);
  });

  it('adds a newly confirmed pair while preserving as many existing zone assignments as possible', () => {
    const registrations = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, localityId: index + 1, localityName: `Localidad ${index + 1}`, label: `Pareja ${index + 1}` }));
    const existing = new Map(Array.from({ length: 8 }, (_, index) => [`7:${index + 1}`, { zoneIndex: index < 4 ? 0 : 1, venueId: 1 }] as const));
    const [plan] = planTournamentDistribution(
      [{ id: 7, name: 'Silvina Cimadamore', registrations }],
      [{ id: 1, name: 'Sede' }],
      new Map([['7:0', 1], ['7:1', 1], ['7:2', 1]]),
      existing,
    );

    expect(plan.capacities).toEqual([3, 3, 3]);
    expect(plan.zones.flatMap((zone) => zone.registrations)).toHaveLength(9);
    const resultingZone = new Map(plan.zones.flatMap((zone, zoneIndex) => zone.registrations.map((registration) => [registration.id, zoneIndex] as const)));
    expect(Array.from({ length: 8 }, (_, index) => index + 1).filter((id) => resultingZone.get(id) === existing.get(`7:${id}`)?.zoneIndex)).toHaveLength(6);
    expect(resultingZone.get(9)).toBe(2);
  });

  it('leaves every new zone without a venue until Direction assigns it', () => {
    const registrations = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, localityId: index + 1, localityName: `Equipo ${index + 1}`, label: `Pareja ${index + 1}` }));
    const [plan] = planTournamentDistribution([{ id: 3, name: 'Damas A', registrations }], [{ id: 1, name: 'Norte' }, { id: 2, name: 'Sur' }]);
    expect(plan.zones.map((zone) => zone.venue)).toEqual([null, null]);
    expect(plan.zones.flatMap((zone) => zone.registrations)).toEqual([]);
    expect(plan.warnings).toContain('Dirección debe asignar una sede a cada zona antes de distribuir las parejas y generar los partidos.');
  });

  it('does not split pairs from one locality across manually separated venues', () => {
    const registrations = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, localityId: index < 2 ? 7 : 100 + index, localityName: index < 2 ? 'Rocha' : `Equipo ${index + 1}`, label: `Pareja ${index + 1}` }));
    const [plan] = planTournamentDistribution([{ id: 3, name: 'Damas A', registrations }], [{ id: 1, name: 'Norte' }, { id: 2, name: 'Sur' }], new Map([['3:0', 1], ['3:1', 2]]));
    expect(plan.warnings).toContain('Rocha no puede ubicarse en una sola sede con la asignación actual de zonas.');
    expect(plan.zones.flatMap((zone) => zone.registrations)).toHaveLength(6);
  });
});
