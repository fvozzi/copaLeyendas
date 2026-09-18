import { describe, expect, it } from 'vitest';
import { distributeShirts } from './shirt-distribution';
import type { PairRegistration } from '../registrations/pair-registration.entity';
import { ShirtSize } from '../registrations/registration.enums';

const request = (size: ShirtSize, brand = '') => ({ playerOneName: 'Jugadora', playerOneShirtSize: size, playerOneHasCommercialAgreement: Boolean(brand), playerOneCommercialAgreementDetails: brand }) as PairRegistration;
const copies = (quantity: number, size: ShirtSize, brand = '') => Array.from({ length: quantity }, () => request(size, brand));

describe('shirt distribution', () => {
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
});
