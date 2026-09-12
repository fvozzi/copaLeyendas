import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminProgramPage } from './AdminProgramPage';
import { getCourts, getVenues, getTournaments, getTournamentScheduleGrid, updateTournamentScheduleSlot } from '../lib/api';
import type { Court, Venue, Tournament, TournamentScheduleSlot } from '../types';

vi.mock('../lib/api', () => ({ getCourts: vi.fn(), getVenues: vi.fn(), getTournaments: vi.fn(), getTournamentScheduleGrid: vi.fn(), updateTournamentScheduleSlot: vi.fn() }));
let root: Root;
let container: HTMLDivElement;
const venue = { id: 1, name: 'Club con nombre largo', active: true } as Venue;
const courts = [1, 2, 3].map((id) => ({ id, venueId: 1, venue, name: `Cancha ${id}`, active: true } as Court));
const slot = { id: 10, tournamentId: 1, tournamentCategoryId: 1, tournamentCategory: { category: { name: 'Damas A' } }, stage: 'ZONE', zoneName: 'A', matchOrder: 1, sequence: 1, courtId: 1, court: courts[0], scheduledAt: '2026-11-20T13:00:00Z' } as TournamentScheduleSlot;
async function click(text: string, selector = 'button') {
  const button = [...container.querySelectorAll<HTMLButtonElement>(selector)].find((item) => item.textContent === text);
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getTournaments).mockResolvedValue([{ id: 1, name: 'Copa' } as Tournament]);
  vi.mocked(getCourts).mockResolvedValue(courts);
  vi.mocked(getVenues).mockResolvedValue([venue]);
  vi.mocked(getTournamentScheduleGrid).mockResolvedValue([slot]);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(AdminProgramPage))));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); });

it('shows all courts in a venue, including empty ones, and filters their games', async () => {
  await click('Sedes');
  expect(container.querySelector('[aria-label="Canchas de la sede"]')?.textContent).toContain('Cancha 2 (0)');
  await click('Cancha 2 (0)');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
  expect(container.textContent).toContain('No hay partidos asignados');
  await click('Cancha 1 (1)');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
});

it('moves a game to an empty court without changing its time and keeps the venue visible', async () => {
  await click('Sedes');
  await click('Cancha 1 (1)');
  vi.mocked(getTournamentScheduleGrid).mockResolvedValue([{ ...slot, courtId: 2, court: courts[1] }]);
  const select = container.querySelector<HTMLSelectElement>('[aria-label="Cancha para partido 1"]')!;
  expect(select.selectedOptions[0].textContent).toBe('Cancha 1');
  expect(select.querySelector('optgroup')?.label).toBe(venue.name);
  await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(updateTournamentScheduleSlot).toHaveBeenCalledWith(10, { courtId: 2 });
  expect(container.querySelector('h2')?.textContent).toBe(venue.name);
  await click('Cancha 2 (1)');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
});
