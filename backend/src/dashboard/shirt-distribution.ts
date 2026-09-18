import type { PairRegistration } from '../registrations/pair-registration.entity';
import { ShirtSize } from '../registrations/registration.enums';

const models = [
  { name: 'Guastavino Color 1', brand: 'guastavino' },
  { name: 'Guastavino Color 2', brand: 'guastavino' },
  { name: 'Dabber Color 3', brand: 'dabber' },
  { name: 'Dabber Color 4', brand: 'dabber' },
];

export function distributeShirts(registrations: PairRegistration[]) {
  const sizes = Object.values(ShirtSize);
  const totals: Record<string, number> = {};
  const requests = new Map(sizes.map(size => [size, { guastavino: 0, dabber: 0, flexible: 0 }]));
  for (const registration of registrations) {
    for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
      const size = registration[`${prefix}ShirtSize`];
      if (!registration[`${prefix}Name`]?.trim() || !size || !requests.has(size)) continue;
      totals[size] = (totals[size] ?? 0) + 1;
      const brand = registration[`${prefix}HasCommercialAgreement`]
        ? registration[`${prefix}CommercialAgreementDetails`]?.trim().toLowerCase() : '';
      requests.get(size)![brand === 'guastavino' || brand === 'dabber' ? brand : 'flexible']++;
    }
  }
  const rows = models.map(model => ({ ...model, sizes: Object.fromEntries(sizes.map(size => [size, 0])), total: 0 }));
  const allocate = (size: ShirtSize, quantity: number, eligible: typeof rows) => {
    for (let count = 0; count < quantity; count++) {
      // Balance each size first; distribute rounding remainders across model totals.
      const target = eligible.reduce((best, row) => row.sizes[size] < best.sizes[size]
        || (row.sizes[size] === best.sizes[size] && row.total < best.total) ? row : best);
      target.sizes[size]++;
      target.total++;
    }
  };
  // Reserve brand commitments before distributing requests without a matching brand.
  for (const size of sizes) for (const brand of ['guastavino', 'dabber'] as const) {
    allocate(size, requests.get(size)![brand], rows.filter(row => row.brand === brand));
  }
  for (const size of sizes) allocate(size, requests.get(size)!.flexible, rows);
  return { sizes, totals, models: rows.map(({ brand: _brand, ...row }) => row), total: rows.reduce((sum, row) => sum + row.total, 0) };
}
