import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminTournamentDetailPage } from './AdminTournamentDetailPage';
import { getCategories, getTournament, getVenues, updateTournamentZone } from '../lib/api';

vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: { role: 'DIRECTOR' } }) }));
vi.mock('../lib/api', () => ({ getCategories: vi.fn(), getTournament: vi.fn(), getVenues: vi.fn(), updateTournamentZone: vi.fn(), addTournamentCategory: vi.fn(), createTournamentZone: vi.fn(), divideTournamentZones: vi.fn(), updateTournamentCategory: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); });

it('shows when a venue has no active courts and allows correction without closing the zone form', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const category = { id: 1, category: { name: 'Damas A' } };
  vi.mocked(getTournament).mockResolvedValue({ id: 1, name: 'Copa', categories: [category], zones: [{ id: 3, name: 'A', capacity: 4, tournamentCategoryId: 1, tournamentCategory: category, venueId: 1, venue: { name: 'FFAA' } }] } as never);
  vi.mocked(getCategories).mockResolvedValue([]);
  vi.mocked(getVenues).mockResolvedValue([{ id: 1, name: 'FFAA', active: true }, { id: 2, name: 'Gure Echea', active: true }] as never);
  vi.mocked(updateTournamentZone).mockRejectedValue(new Error('No hay canchas activas en Gure Echea para asignar los partidos de la zona.'));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ['/app/torneos/1'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(Routes, null, createElement(Route, { path: '/app/torneos/:id', element: createElement(AdminTournamentDetailPage) })))));
  const edit = container.querySelectorAll('table')[1].querySelector('tbody button') as HTMLButtonElement;
  await act(async () => edit.click());
  const form = document.querySelector('form')!;
  const venue = form.querySelector('select')!;
  await act(async () => { venue.value = '2'; venue.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(updateTournamentZone).toHaveBeenCalledWith(3, expect.objectContaining({ venueId: 2 }));
  expect(form.querySelector('[role="alert"]')?.textContent).toContain('No hay canchas activas');
  expect(venue.value).toBe('2');
  expect(form.querySelector('button')?.disabled).toBe(false);
});
