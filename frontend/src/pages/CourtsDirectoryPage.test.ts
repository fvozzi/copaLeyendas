import { expect, it } from 'vitest';
import type { CommunityCourt } from '../types';
import { filterCommunityCourts } from './CourtsDirectoryPage';

const courts: CommunityCourt[] = [
  { id: 1, name: 'Club Paraná', country: 'Argentina', province: 'Entre Ríos', locality: 'Paraná', address: null, courtType: 'TRINQUET', trinquetShareMaterial: 'WOOD', trinquetShareMaterialOther: null, frontonWallOrientation: null, frontonHasCacerola: null, frontonBackType: null, frontonReboundMaterial: null, latitude: -31, longitude: -60, lengthMeters: null, widthMeters: null, totalPlayers: 20, createdAt: '', playerGroups: [{ gender: 'FEMALE', minAge: 18, maxAge: 59, playerCount: 20 }] },
  { id: 2, name: 'Frontón Sur', country: 'Uruguay', province: 'Montevideo', locality: 'Montevideo', address: null, courtType: 'FRONTON', trinquetShareMaterial: null, trinquetShareMaterialOther: null, frontonWallOrientation: 'LEFT_LONG', frontonHasCacerola: true, frontonBackType: 'REBOUND', frontonReboundMaterial: 'Material', latitude: -34, longitude: -56, lengthMeters: null, widthMeters: null, totalPlayers: 12, createdAt: '', playerGroups: [{ gender: 'MALE', minAge: 60, maxAge: 80, playerCount: 12 }] },
];

it('filters public courts by location, sex and age range', () => {
  expect(filterCommunityCourts(courts, { search: 'parana', country: '', gender: 'FEMALE', age: 40 }).map((court) => court.id)).toEqual([1]);
  expect(filterCommunityCourts(courts, { search: '', country: '', gender: 'FEMALE', age: 70 })).toEqual([]);
  expect(filterCommunityCourts(courts, { search: '', country: 'Uruguay', gender: '', age: 70 }).map((court) => court.id)).toEqual([2]);
  expect(filterCommunityCourts(courts, { search: '', country: '', courtType: 'FRONTON', gender: '' }).map((court) => court.id)).toEqual([2]);
  expect(filterCommunityCourts(courts, { search: '', country: '', gender: '', age: 17 })).toEqual([]);
});
