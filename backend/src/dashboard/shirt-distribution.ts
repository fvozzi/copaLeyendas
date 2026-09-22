import type { PairRegistration } from '../registrations/pair-registration.entity';
import { ShirtSize } from '../registrations/registration.enums';

const models = [
  { name: 'Guastavino Color 1', brand: 'guastavino' },
  { name: 'Guastavino Color 2', brand: 'guastavino' },
  { name: 'Dabber Color 3', brand: 'dabber' },
  { name: 'Dabber Color 4', brand: 'dabber' },
] as const;
type ShirtBrand = (typeof models)[number]['brand'];

export interface ShirtZoneEntry {
  registrationId: number;
  zoneId: number;
  zoneName: string;
  categoryId: number;
  seed?: number;
}

export interface ShirtPlayer {
  registrationId: number;
  position: 'playerOne' | 'playerTwo' | 'playerThree';
  name: string;
  size: ShirtSize;
  team: string;
  category: string;
  zone: string | null;
  brand: string | null;
}

interface ShirtPair {
  registrationId: number;
  category: string;
  zoneId: number | null;
  zoneSeed: number;
  players: ShirtPlayer[];
  requiredBrands: ShirtBrand[];
}

function shirtBrand(value: string | null): ShirtBrand | null {
  const normalized = value?.trim().toLocaleLowerCase('es') ?? '';
  return normalized === 'guastavino' || normalized === 'dabber' ? normalized : null;
}

function categoryKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]/g, '');
}

export function distributeShirts(registrations: PairRegistration[], zoneEntries: ShirtZoneEntry[] = []) {
  const sizes = Object.values(ShirtSize);
  const totals: Record<string, number> = {};
  const zonesByRegistration = new Map(zoneEntries.map(entry => [entry.registrationId, entry]));
  const pairs: ShirtPair[] = [];
  // Sorting by ID makes a refresh or database row order produce the same assignment.
  for (const registration of [...registrations].sort((a, b) => {
    const idDifference = (a.id ?? 0) - (b.id ?? 0);
    if (idDifference) return idDifference;
    const key = (item: PairRegistration) => ['playerOne', 'playerTwo', 'playerThree'].map(prefix => [
      item[`${prefix}Name` as 'playerOneName'] ?? '',
      item[`${prefix}ShirtSize` as 'playerOneShirtSize'] ?? '',
      item[`${prefix}CommercialAgreementDetails` as 'playerOneCommercialAgreementDetails'] ?? '',
    ].join(':')).join('|');
    return key(a).localeCompare(key(b), 'es');
  })) {
    const assignedZone = zonesByRegistration.get(registration.id);
    const zone = assignedZone?.categoryId === registration.categoryId ? assignedZone : undefined;
    const players: ShirtPlayer[] = [];
    for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
      const size = registration[`${prefix}ShirtSize`];
      if (!registration[`${prefix}Name`]?.trim() || !size || !sizes.includes(size)) continue;
      totals[size] = (totals[size] ?? 0) + 1;
      players.push({
        registrationId: registration.id, position: prefix, name: registration[`${prefix}Name`]!.trim(), size,
        team: registration.localityName, category: registration.category?.name ?? '', zone: zone?.zoneName ?? null,
        brand: registration[`${prefix}HasCommercialAgreement`] ? registration[`${prefix}CommercialAgreementDetails`]?.trim() || null : null,
      });
    }
    if (players.length) pairs.push({
      registrationId: registration.id, category: registration.category?.name ?? '', zoneId: zone?.zoneId ?? null,
      zoneSeed: zone?.seed ?? registration.id ?? 0,
      players, requiredBrands: [...new Set(players.map(player => shirtBrand(player.brand)).filter((brand): brand is ShirtBrand => brand !== null))],
    });
  }

  const rows = models.map(model => ({ ...model, sizes: Object.fromEntries(sizes.map(size => [size, 0])), total: 0, players: [] as ShirtPlayer[] }));
  const usedColors = new Map<number, Map<string, number>>();
  const countBrand = (brand: ShirtBrand) => rows.filter(row => row.brand === brand).reduce((sum, row) => sum + row.total, 0);
  const assign = (pair: ShirtPair, players: ShirtPlayer[], target: (typeof rows)[number]) => {
    for (const player of players) {
      target.sizes[player.size]++;
      target.total++;
      target.players.push(player);
    }
    if (pair.zoneId !== null) {
      const colors = usedColors.get(pair.zoneId) ?? new Map<string, number>();
      colors.set(target.name, (colors.get(target.name) ?? 0) + 1);
      usedColors.set(pair.zoneId, colors);
    }
  };
  const allocate = (pair: ShirtPair, players: ShirtPlayer[], brand: ShirtBrand) => {
    const colors = pair.zoneId === null ? null : usedColors.get(pair.zoneId) ?? new Map<string, number>();
    const eligible = rows.filter(row => row.brand === brand);
    const target = eligible.reduce((best, row) => {
      const cost = (item: typeof row) => [
        colors?.get(item.name) ?? 0,
        players.reduce((sum, player) => sum + item.sizes[player.size], 0),
        item.total,
      ];
      const left = cost(row); const right = cost(best);
      return left[0] < right[0] || left[0] === right[0] && (left[1] < right[1] || left[1] === right[1] && left[2] < right[2]) ? row : best;
    });
    assign(pair, players, target);
  };
  const allocateConflictingPair = (pair: ShirtPair) => {
    const flexible = pair.players.filter(player => !shirtBrand(player.brand));
    pair.requiredBrands.forEach((brand, index) => {
      const represented = pair.players.filter(player => shirtBrand(player.brand) === brand);
      // Players without a competing agreement wear the exact same color as the
      // first represented brand in their team.
      allocate(pair, index === 0 ? [...represented, ...flexible] : represented, brand);
    });
  };

  const cimaGuastavino = pairs.filter(pair => categoryKey(pair.category).includes('cimadamore') && pair.requiredBrands.includes('guastavino')).length;
  const gomaDabberAgreements = pairs.filter(pair => categoryKey(pair.category).includes('gomaa') && pair.requiredBrands.includes('dabber')).length;
  let gomaDabberCompensation = Math.max(0, cimaGuastavino - 4 - gomaDabberAgreements);
  const byZone = new Map<number, ShirtPair[]>();
  for (const pair of pairs) if (pair.zoneId !== null) byZone.set(pair.zoneId, [...(byZone.get(pair.zoneId) ?? []), pair]);
  const assigned = new Set<ShirtPair>();
  for (const zonePairs of [...byZone.entries()].sort(([left], [right]) => left - right).map(([, value]) => value)) {
    const ordered = [...zonePairs].sort((a, b) => a.zoneSeed - b.zoneSeed || a.registrationId - b.registrationId);
    const forcedDabber = new Set(ordered.filter(pair => !pair.requiredBrands.length && categoryKey(pair.category).includes('gomaa')).slice(0, gomaDabberCompensation));
    gomaDabberCompensation -= forcedDabber.size;
    for (const pair of ordered.filter(pair => pair.requiredBrands.length > 1)) {
      assigned.add(pair);
      // A pair with conflicting agreements cannot share a model. Honor each player.
      allocateConflictingPair(pair);
    }
    const candidates = ordered.filter(pair => pair.requiredBrands.length <= 1);
    const choices = candidates.map(pair => {
      const required = pair.requiredBrands[0] ?? (forcedDabber.has(pair) ? 'dabber' : null);
      return rows.filter(row => !required || row.brand === required);
    });
    let bestModels: typeof rows = [];
    let bestScore: number[] | null = null;
    const compare = (left: number[], right: number[]) => {
      for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return left[index] - right[index];
      return 0;
    };
    const evaluate = (selected: typeof rows) => {
      let colorConflicts = 0;
      let differentBrands = 0;
      const existingColors = usedColors.get(ordered[0].zoneId!) ?? new Map<string, number>();
      for (let index = 0; index < selected.length; index++) {
        colorConflicts += existingColors.get(selected[index].name) ?? 0;
        for (let other = index + 1; other < selected.length; other++) {
          const firstSeed = candidates[index].zoneSeed;
          const secondSeed = candidates[other].zoneSeed;
          const firstMatch = firstSeed === 1 && secondSeed === 2 || firstSeed === 3 && secondSeed === 4;
          const weight = firstMatch ? 3 : 1;
          if (selected[index].name === selected[other].name) colorConflicts += weight;
          if (selected[index].brand !== selected[other].brand) differentBrands += weight;
        }
      }
      const projected = rows.map(row => ({ ...row.sizes }));
      selected.forEach((row, index) => {
        const counts = projected[rows.indexOf(row)];
        for (const player of candidates[index].players) counts[player.size]++;
      });
      const sizeImbalance = sizes.reduce((sum, size) => sum + projected.reduce((total, counts) => total + counts[size] ** 2, 0), 0);
      return [colorConflicts, differentBrands, sizeImbalance];
    };
    const search = (selected: typeof rows) => {
      if (selected.length === candidates.length) {
        const score = evaluate(selected);
        if (!bestScore || compare(score, bestScore) < 0) { bestScore = score; bestModels = [...selected]; }
        return;
      }
      for (const row of choices[selected.length]) search([...selected, row]);
    };
    search([]);
    candidates.forEach((pair, index) => { assigned.add(pair); assign(pair, pair.players, bestModels[index]); });
  }
  for (const pair of pairs) {
    if (assigned.has(pair)) continue;
    if (pair.requiredBrands.length > 1) {
      allocateConflictingPair(pair);
      continue;
    }
    let brand = pair.requiredBrands[0] ?? (countBrand('guastavino') <= countBrand('dabber') ? 'guastavino' : 'dabber');
    if (!pair.requiredBrands.length && categoryKey(pair.category).includes('gomaa') && gomaDabberCompensation > 0) {
      brand = 'dabber';
      gomaDabberCompensation--;
    }
    allocate(pair, pair.players, brand);
  }
  return { sizes, totals, models: rows.map(({ brand: _brand, ...row }) => row), total: Object.values(totals).reduce((sum, count) => sum + count, 0) };
}
