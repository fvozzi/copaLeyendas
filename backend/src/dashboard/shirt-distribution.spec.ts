import { describe, expect, it } from 'vitest';
import { distributeShirts } from './shirt-distribution';
import type { PairRegistration } from '../registrations/pair-registration.entity';
import { ShirtSize } from '../registrations/registration.enums';

const request = (size: ShirtSize, brand = '') => ({ playerOneName: 'Jugadora', playerOneShirtSize: size, playerOneHasCommercialAgreement: Boolean(brand), playerOneCommercialAgreementDetails: brand }) as PairRegistration;
const copies = (quantity: number, size: ShirtSize, brand = '') => Array.from({ length: quantity }, () => request(size, brand));
const pair = (id: number, category: string, brand = '', secondBrand = '', thirdBrand?: string) => ({
  id, categoryId: 1, category: { name: category }, localityName: `Equipo ${id}`,
  playerOneName: `Uno ${id}`, playerOneShirtSize: ShirtSize.M, playerOneHasCommercialAgreement: Boolean(brand), playerOneCommercialAgreementDetails: brand,
  playerTwoName: `Dos ${id}`, playerTwoShirtSize: ShirtSize.L, playerTwoHasCommercialAgreement: Boolean(secondBrand), playerTwoCommercialAgreementDetails: secondBrand,
  playerThreeName: thirdBrand === undefined ? null : `Tres ${id}`, playerThreeShirtSize: ShirtSize.S,
  playerThreeHasCommercialAgreement: Boolean(thirdBrand), playerThreeCommercialAgreementDetails: thirdBrand ?? null,
}) as PairRegistration;
const assignedModels = (result: ReturnType<typeof distributeShirts>, registrationId: number) => result.models.filter(model => model.players.some(player => player.registrationId === registrationId));

describe('shirt distribution', () => {
  it('keeps the exact players behind each count, respecting brand and stable identities', () => {
    const registrations = Array.from({ length: 12 }, (_, index) => ({
      ...request(index % 2 ? ShirtSize.S : ShirtSize.M, index < 4 ? 'Guastavino' : index < 7 ? 'Dabber' : ''),
      id: index + 1, playerOneName: `Jugadora ${index + 1}`, localityName: 'Equipo', category: { name: 'Damas A' },
    })) as PairRegistration[];
    const result = distributeShirts(registrations);
    expect(result).toEqual(distributeShirts([...registrations].reverse()));
    const players = result.models.flatMap(model => model.players);
    expect(players).toHaveLength(12);
    expect(new Set(players.map(player => `${player.registrationId}-${player.position}`)).size).toBe(12);
    for (const model of result.models) {
      expect(model.players).toHaveLength(model.total);
      for (const size of result.sizes) expect(model.players.filter(player => player.size === size)).toHaveLength(model.sizes[size]);
      for (const player of model.players) {
        if (player.brand) expect(model.name.startsWith(player.brand)).toBe(true);
        expect(player.team).toBe('Equipo');
        expect(player.category).toBe('Damas A');
      }
    }
  });
  it('balances each size among four models and spreads rounding remainders across totals', () => {
    const result = distributeShirts([...copies(5, ShirtSize.S), ...copies(14, ShirtSize.M), ...copies(5, ShirtSize.L), ...copies(3, ShirtSize.XL), ...copies(2, ShirtSize.XXL), ...copies(3, ShirtSize.XXXL), request(ShirtSize.XXXXL)]);
    expect(result.total).toBe(33);
    expect(result.models.map(row => row.total).sort()).toEqual([8, 8, 8, 9]);
    for (const size of result.sizes) {
      const counts = result.models.map(row => row.sizes[size]);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(result.totals[size] ?? 0);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });
  it('honors both brands even when an even four-way split is impossible', () => {
    const result = distributeShirts([...copies(9, ShirtSize.M, ' Guastavino '), ...copies(1, ShirtSize.M, 'DABBER'), ...copies(2, ShirtSize.M)]);
    expect(result.models.map(row => row.sizes.M)).toEqual([5, 4, 2, 1]);
    expect(result.total).toBe(12);
    const onlyDabber = distributeShirts(copies(7, ShirtSize.L, 'Dabber'));
    expect(onlyDabber.models.map(row => row.total)).toEqual([0, 0, 4, 3]);
  });
  it('counts actual substitutes, ignores stale fields for missing players and treats other brands as flexible', () => {
    const registration = { ...request(ShirtSize.S, 'Otra'), playerTwoName: 'Dos', playerTwoShirtSize: ShirtSize.M,
      playerTwoHasCommercialAgreement: false, playerTwoCommercialAgreementDetails: 'Guastavino',
      playerThreeName: ' ', playerThreeShirtSize: ShirtSize.L, playerThreeHasCommercialAgreement: true, playerThreeCommercialAgreementDetails: 'Dabber' } as PairRegistration;
    expect(distributeShirts([registration]).totals).toEqual({ S: 1, M: 1 });
    registration.playerThreeName = 'Suplente';
    const result = distributeShirts([registration]);
    expect(result.total).toBe(3);
    expect(result.models.slice(2).reduce((sum, row) => sum + row.sizes.L, 0)).toBe(1);
    expect(result.models.slice(0, 2).reduce((sum, row) => sum + row.sizes.L, 0)).toBe(0);
  });
  it('is independent of registration order, includes empty sizes and returns four empty rows when there are no requests', () => {
    const requests = [...copies(3, ShirtSize.S, 'Dabber'), ...copies(5, ShirtSize.M, 'Guastavino'), ...copies(4, ShirtSize.M), ...copies(2, ShirtSize.XL)];
    expect(distributeShirts(requests)).toEqual(distributeShirts([...requests].reverse()));
    const empty = distributeShirts([]);
    expect(empty.models).toHaveLength(4);
    expect(empty.total).toBe(0);
    expect(empty.sizes).toEqual(Object.values(ShirtSize));
    expect(empty.models.every(row => Object.values(row.sizes).every(count => count === 0))).toBe(true);
  });
  it('gives both partners and the substitute one color and keeps the opening matches within a brand', () => {
    const registrations = [pair(1, 'Goma A', 'Guastavino', '', ''), pair(2, 'Goma A'), pair(3, 'Goma A'), pair(4, 'Goma A')];
    const entries = registrations.map(registration => ({ registrationId: registration.id, zoneId: 10, zoneName: 'Zona A', categoryId: 1 }));
    const result = distributeShirts(registrations, entries);
    expect(result).toEqual(distributeShirts([...registrations].reverse(), [...entries].reverse()));
    expect(result.total).toBe(9);
    for (const registration of registrations) {
      const assigned = assignedModels(result, registration.id);
      expect(assigned).toHaveLength(1);
      expect(assigned[0].players.filter(player => player.registrationId === registration.id).every(player => player.zone === 'Zona A')).toBe(true);
    }
    expect(new Set(registrations.map(registration => assignedModels(result, registration.id)[0].name)).size).toBe(4);
    expect(assignedModels(result, 1)[0].name).toMatch(/^Guastavino/);
    expect(assignedModels(result, 2)[0].name).toMatch(/^Guastavino/);
    expect(assignedModels(result, 3)[0].name).toMatch(/^Dabber/);
    expect(assignedModels(result, 4)[0].name).toMatch(/^Dabber/);
  });
  it('uses all four colors in a zone when two pairs require each brand', () => {
    const registrations = [pair(1, 'Goma A', 'Guastavino'), pair(2, 'Goma A', 'Guastavino'), pair(3, 'Goma A', 'Dabber'), pair(4, 'Goma A', 'Dabber')];
    const result = distributeShirts(registrations, registrations.map(registration => ({ registrationId: registration.id, zoneId: 1, zoneName: 'Zona A', categoryId: 1 })));
    expect(new Set(registrations.map(registration => assignedModels(result, registration.id)[0].name)).size).toBe(4);
  });
  it('uses zone seeds rather than registration order for the two opening matches', () => {
    const registrations = [pair(10, 'Goma A', 'Guastavino'), pair(20, 'Goma A'), pair(30, 'Goma A'), pair(40, 'Goma A')];
    const seeds = [1, 3, 2, 4];
    const result = distributeShirts(registrations, registrations.map((registration, index) => ({
      registrationId: registration.id, zoneId: 1, zoneName: 'Zona A', categoryId: 1, seed: seeds[index],
    })));
    expect(assignedModels(result, 10)[0].name).toMatch(/^Guastavino/);
    expect(assignedModels(result, 30)[0].name).toMatch(/^Guastavino/);
    expect(assignedModels(result, 20)[0].name).toMatch(/^Dabber/);
    expect(assignedModels(result, 40)[0].name).toMatch(/^Dabber/);
    expect(new Set(registrations.map(registration => assignedModels(result, registration.id)[0].name)).size).toBe(4);
  });
  it('uses opposite colors in the opening matches when four Guastavino agreements make repeats unavoidable', () => {
    const registrations = [1, 2, 3, 4].map(id => pair(id, 'Goma A', 'Guastavino'));
    const result = distributeShirts(registrations, registrations.map(registration => ({
      registrationId: registration.id, zoneId: 1, zoneName: 'Zona A', categoryId: 1, seed: registration.id,
    })));
    expect(assignedModels(result, 1)[0].name).not.toBe(assignedModels(result, 2)[0].name);
    expect(assignedModels(result, 3)[0].name).not.toBe(assignedModels(result, 4)[0].name);
    expect(result.models.slice(2).every(model => model.total === 0)).toBe(true);
  });
  it('compensates excess Guastavino commitments in Cimadamore with Dabber in Goma A', () => {
    const registrations = [1, 2, 3, 4, 5, 6].map(id => pair(id, 'Cimadamore', 'Guastavino'));
    registrations.push(pair(7, 'Goma A'), pair(8, 'Goma A'), pair(9, 'Goma A', 'Guastavino'));
    const result = distributeShirts(registrations);
    expect(assignedModels(result, 7)[0].name).toMatch(/^Dabber/);
    expect(assignedModels(result, 8)[0].name).toMatch(/^Dabber/);
    expect(assignedModels(result, 9)[0].name).toMatch(/^Guastavino/);
  });
  it('counts existing Dabber agreements in Goma A toward the Cimadamore compensation', () => {
    const registrations = [1, 2, 3, 4, 5, 6].map(id => pair(id, 'Cimadamore', 'Guastavino'));
    registrations.push(pair(7, 'Goma A', 'Dabber'), pair(8, 'Goma A'), pair(9, 'Goma A', 'Guastavino'), pair(10, 'Goma A'));
    const entries = registrations.filter(registration => registration.id >= 7).map((registration, index) => ({
      registrationId: registration.id, zoneId: 2, zoneName: 'Zona A', categoryId: 1, seed: index + 1,
    }));
    const result = distributeShirts(registrations, entries);
    expect(new Set([7, 8, 9, 10].map(id => assignedModels(result, id)[0].name)).size).toBe(4);
    expect([7, 8, 9, 10].filter(id => assignedModels(result, id)[0].name.startsWith('Dabber'))).toHaveLength(2);
  });
  it('keeps each agreement when the two players in a pair represent different sponsors', () => {
    const result = distributeShirts([pair(1, 'Goma A', 'Guastavino', 'Dabber', '')]);
    expect(result.total).toBe(3);
    const playerOneModel = result.models.find(model => model.players.some(player => player.position === 'playerOne'));
    expect(playerOneModel?.name).toMatch(/^Guastavino/);
    expect(result.models.find(model => model.players.some(player => player.position === 'playerTwo'))?.name).toMatch(/^Dabber/);
    expect(result.models.find(model => model.players.some(player => player.position === 'playerThree'))?.name).toBe(playerOneModel?.name);
    expect(assignedModels(result, 1)).toHaveLength(2);
  });
  it('keeps the flexible teammate on the represented partner color inside a zone', () => {
    const registration = pair(1, 'Goma A', 'Guastavino', 'Dabber', 'Otra');
    const result = distributeShirts([registration], [{ registrationId: 1, zoneId: 10, zoneName: 'Zona A', categoryId: 1, seed: 1 }]);
    const playerOneModel = result.models.find(model => model.players.some(player => player.position === 'playerOne'));
    expect(result.models.find(model => model.players.some(player => player.position === 'playerThree'))?.name).toBe(playerOneModel?.name);
    expect(assignedModels(result, 1)).toHaveLength(2);
  });
  it('treats Otra as flexible so a pair can share the Guastavino color', () => {
    const result = distributeShirts([pair(1, 'Goma A', 'Guastavino', 'Otra')]);
    expect(assignedModels(result, 1)).toHaveLength(1);
    expect(assignedModels(result, 1)[0].name).toMatch(/^Guastavino/);
  });
});
