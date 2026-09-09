import type { Locality } from '../types';

export function getRegistrationLocalities(localities: Locality[]) {
  const unique = new Map<string, Locality>();
  for (const locality of localities) {
    if (!locality.active || !locality.category?.active) continue;
    const key = JSON.stringify([
      normalizeName(locality.name),
      normalizeName(locality.provinceName),
      locality.category.id,
    ]);
    const existing = unique.get(key);
    if (!existing || locality.id < existing.id) unique.set(key, locality);
  }
  return [...unique.values()];
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
