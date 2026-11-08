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
    const [plan] = planTournamentDistribution([{ id: 3, name: 'Damas A', registrations }], [{ id: 1, name: 'Sede Norte' }, { id: 2, name: 'Sede Sur' }]);
    expect(plan.capacities).toEqual([4, 4]);
    const localityZones = plan.zones.filter((zone) => zone.registrations.some((registration) => registration.localityId === 1));
    expect(localityZones.map((zone) => zone.registrations.filter((registration) => registration.localityId === 1).length)).toEqual([1, 1]);
    expect(new Set(localityZones.map((zone) => zone.venue?.id)).size).toBe(1);
  });

  it('prefers the same venue for a locality appearing in another category', () => {
    const categories = [1, 2].map((categoryId) => ({ id: categoryId, name: `Categoria ${categoryId}`, registrations: Array.from({ length: 6 }, (_, index) => ({ id: categoryId * 10 + index, localityId: index === 0 ? 7 : categoryId * 100 + index, localityName: index === 0 ? 'Rocha' : `Localidad ${categoryId}-${index}`, label: `Pareja ${index}` })) }));
    const plans = planTournamentDistribution(categories, [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    const localityVenue = (plan: typeof plans[number]) => plan.zones.find((zone) => zone.registrations.some((registration) => registration.localityId === 7))?.venue?.id;
    expect(localityVenue(plans[1])).toBe(localityVenue(plans[0]));
  });
});
