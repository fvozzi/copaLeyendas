import type { PairRegistration } from '../registrations/pair-registration.entity';
import { ShirtSize } from '../registrations/registration.enums';

const models = [
  { name: 'Guastavino Color 1', brand: 'guastavino' },
  { name: 'Guastavino Color 2', brand: 'guastavino' },
  { name: 'Dabber Color 3', brand: 'dabber' },
  { name: 'Dabber Color 4', brand: 'dabber' },
];

export interface ShirtPlayer {
  registrationId: number;
  position: 'playerOne' | 'playerTwo' | 'playerThree';
  name: string;
  size: ShirtSize;
  team: string;
  category: string;
  brand: string | null;
}

export function distributeShirts(registrations: PairRegistration[]) {
  const sizes = Object.values(ShirtSize);
  const totals: Record<string, number> = {};
  const requests = new Map(sizes.map(size => [size, { guastavino: [] as ShirtPlayer[], dabber: [] as ShirtPlayer[], flexible: [] as ShirtPlayer[] }]));
  // Stable identities keep a refresh or database row order from swapping players between colors.
  for (const registration of [...registrations].sort((a, b) => a.id - b.id)) {
    for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
      const size = registration[`${prefix}ShirtSize`];
      if (!registration[`${prefix}Name`]?.trim() || !size || !requests.has(size)) continue;
      totals[size] = (totals[size] ?? 0) + 1;
      const brand = registration[`${prefix}HasCommercialAgreement`]
        ? registration[`${prefix}CommercialAgreementDetails`]?.trim().toLowerCase() : '';
      requests.get(size)![brand === 'guastavino' || brand === 'dabber' ? brand : 'flexible'].push({
        registrationId: registration.id, position: prefix, name: registration[`${prefix}Name`]!.trim(), size,
        team: registration.localityName, category: registration.category?.name ?? '',
        brand: registration[`${prefix}HasCommercialAgreement`] ? registration[`${prefix}CommercialAgreementDetails`]?.trim() || null : null,
      });
    }
  }
  const rows = models.map(model => ({ ...model, sizes: Object.fromEntries(sizes.map(size => [size, 0])), total: 0, players: [] as ShirtPlayer[] }));
  const allocate = (size: ShirtSize, players: ShirtPlayer[], eligible: typeof rows) => {
    for (const player of players) {
      // Balance each size first; distribute rounding remainders across model totals.
      const target = eligible.reduce((best, row) => row.sizes[size] < best.sizes[size]
        || (row.sizes[size] === best.sizes[size] && row.total < best.total) ? row : best);
      target.sizes[size]++;
      target.total++;
      target.players.push(player);
    }
  };
  // Reserve brand commitments before distributing requests without a matching brand.
  for (const size of sizes) for (const brand of ['guastavino', 'dabber'] as const) {
    allocate(size, requests.get(size)![brand], rows.filter(row => row.brand === brand));
  }
  for (const size of sizes) allocate(size, requests.get(size)!.flexible, rows);
  return { sizes, totals, models: rows.map(({ brand: _brand, ...row }) => row), total: rows.reduce((sum, row) => sum + row.total, 0) };
}
