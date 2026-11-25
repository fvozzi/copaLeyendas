import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import type { CommunityCourt } from '../types';
import { CourtsDirectoryPage, filterCommunityCourts } from './CourtsDirectoryPage';

vi.mock('../components/CourtMap', () => ({ CourtMap: () => null }));
vi.mock('../lib/api', () => ({ getPublicCourts: vi.fn(async () => []), resolveApiAssetUrl: (path: string) => path }));

const courts: CommunityCourt[] = [
  { id: 1, name: 'Club Paraná', country: 'Argentina', province: 'Entre Ríos', locality: 'Paraná', address: null, courtType: 'TRINQUET', frontisFinish: 'HARD', courtColor: 'WHITE', history: 'Sede del primer torneo barrial.', hasSchool: true, photos: [], trinquetShareMaterial: 'WOOD', trinquetShareMaterialOther: null, frontonWallOrientation: null, frontonHasCacerola: null, frontonBackType: null, frontonReboundMaterial: null, latitude: -31, longitude: -60, lengthMeters: null, widthMeters: null, totalPlayers: 20, createdAt: '', playerGroups: [{ gender: 'FEMALE', minAge: 18, maxAge: 59, playerCount: 20 }] },
  { id: 2, name: 'Frontón Sur', country: 'Uruguay', province: 'Montevideo', locality: 'Montevideo', address: null, courtType: 'FRONTON', frontisFinish: 'MARBLE', courtColor: 'BLUE', history: null, hasSchool: false, photos: [], trinquetShareMaterial: null, trinquetShareMaterialOther: null, frontonWallOrientation: 'LEFT_LONG', frontonHasCacerola: true, frontonBackType: 'REBOUND', frontonReboundMaterial: 'Material', latitude: -34, longitude: -56, lengthMeters: null, widthMeters: null, totalPlayers: 12, createdAt: '', playerGroups: [{ gender: 'MALE', minAge: 60, maxAge: 80, playerCount: 12 }] },
];

it('filters public courts by location, sex and age range', () => {
  expect(filterCommunityCourts(courts, { search: 'parana', country: '', gender: 'FEMALE', age: 40 }).map((court) => court.id)).toEqual([1]);
  expect(filterCommunityCourts(courts, { search: '', country: '', gender: 'FEMALE', age: 70 })).toEqual([]);
  expect(filterCommunityCourts(courts, { search: '', country: 'Uruguay', gender: '', age: 70 }).map((court) => court.id)).toEqual([2]);
  expect(filterCommunityCourts(courts, { search: '', country: '', courtType: 'FRONTON', gender: '' }).map((court) => court.id)).toEqual([2]);
  expect(filterCommunityCourts(courts, { search: 'primer torneo', country: '', gender: '' }).map((court) => court.id)).toEqual([1]);
  expect(filterCommunityCourts(courts, { search: '', country: '', gender: '', age: 17 })).toEqual([]);
});

it('starts with collapsed filters on mobile and lets the user expand them', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(CourtsDirectoryPage))));
  const toggle = container.querySelector('.court-directory-filter-toggle') as HTMLButtonElement;
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelector('#court-directory-filters')).toBeNull();

  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(container.querySelector('#court-directory-filters')).not.toBeNull();

  await act(async () => root.unmount());
  container.remove();
});
