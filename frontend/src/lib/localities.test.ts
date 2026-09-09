import { describe, expect, it } from 'vitest';
import type { Locality } from '../types';
import { getRegistrationLocalities } from './localities';

function locality(id: number, overrides: Partial<Locality> = {}): Locality {
  return {
    id, name: 'Junin', provinceName: 'Buenos Aires', active: true, categoryId: 1,
    category: { id: 1, name: 'Damas A', active: true },
    ...overrides,
  } as Locality;
}

describe('registration locality options', () => {
  it('groups case and spacing variants and consistently keeps the oldest ID', () => {
    const original = locality(1);
    const duplicate = locality(3, { name: ' JUNIN ', provinceName: 'Buenos   aires' });
    expect(getRegistrationLocalities([duplicate, original, locality(2)])).toEqual([original]);
  });

  it('keeps different provinces and categories as separate options', () => {
    const items = [locality(1), locality(2, { provinceName: 'Mendoza' }), locality(3, {
      categoryId: 2, category: { id: 2, name: 'Damas B', active: true } as Locality['category'],
    })];
    expect(getRegistrationLocalities(items)).toEqual(items);
  });

  it('ignores inactive entries before choosing the representative', () => {
    const active = locality(3);
    expect(getRegistrationLocalities([
      locality(1, { active: false }), locality(2, { category: null }), active,
      locality(4, { category: { id: 1, name: 'Damas A', active: false } as Locality['category'] }),
    ])).toEqual([active]);
  });
});
