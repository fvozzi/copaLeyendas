import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminProgramPage } from './AdminProgramPage';
import { getCourts, getVenues, getTournaments, getTournamentScheduleGrid, updateTournamentScheduleSlot, redistributeTournamentCourts, saveMatchResult } from '../lib/api';
import type { Court, Venue, Tournament, TournamentScheduleSlot } from '../types';

vi.mock('../lib/api', () => ({ getCourts: vi.fn(), getVenues: vi.fn(), getTournaments: vi.fn(), getTournamentScheduleGrid: vi.fn(), updateTournamentScheduleSlot: vi.fn(), redistributeTournamentCourts: vi.fn(), saveMatchResult: vi.fn() }));
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

it('summarizes each category and zone once for the entire venue, including its knockout stages', async () => {
  const elsewhere = { ...courts[0], id: 9, venueId: 9, venue: { ...venue, id: 9, name: 'Otra sede' } };
  vi.mocked(redistributeTournamentCourts).mockResolvedValue([
    slot, { ...slot, id: 11, sequence: 2 },
    { ...slot, id: 12, sequence: 3, zoneName: 'Zona B', courtId: 2, court: courts[1] },
    { ...slot, id: 13, sequence: 4, stage: 'QUARTERFINAL', zoneName: 'Cuartos de final' },
    { ...slot, id: 14, sequence: 5, tournamentCategoryId: 2, tournamentCategory: { category: { name: 'Damas B' } }, zoneName: 'C' } as TournamentScheduleSlot,
    { ...slot, id: 15, sequence: 6, zoneName: 'D', courtId: elsewhere.id, court: elsewhere },
  ]);
  await click('Completar sin cambiar horarios');
  await click('Sedes');
  const summary = container.querySelector('[aria-label="Categorías y zonas de la sede"]')!;
  expect([...summary.querySelectorAll('dt')].map((item) => item.textContent)).toEqual(['Damas A', 'Damas B']);
  expect([...summary.querySelectorAll('dd')].map((item) => item.textContent)).toEqual(['Zonas A, B · Cuartos de final', 'Zona C']);
  await click('Cancha 2 (1)');
  expect(container.querySelector('[aria-label="Categorías y zonas de la sede"]')?.textContent).toBe(summary.textContent);
  await click('Otra sede');
  expect(container.querySelector('[aria-label="Categorías y zonas de la sede"]')?.textContent).toBe('Damas AZona D');
});

it('shows actual pairs and submits results to the real fixture match, not the planning row', async () => {
  const actual = { ...slot, matchId: 500, match: { id: 500, zoneId: 9, matchOrder: 1, status: 'READY', homeRegistration: { playerOneName: 'Ana', playerTwoName: 'Bea', localityName: 'Junin' }, awayRegistration: { playerOneName: 'Carla', playerTwoName: 'Dora', localityName: 'Salta' }, homeScore: null, awayScore: null } } as TournamentScheduleSlot;
  vi.mocked(redistributeTournamentCourts).mockResolvedValue([actual]);
  await click('Completar sin cambiar horarios');
  expect(container.textContent).toContain('Ana / Bea (Junin) vs Carla / Dora (Salta)');
  expect(container.querySelector('a[href="/app/zonas/9"]')).toBeTruthy();
  vi.mocked(getTournamentScheduleGrid).mockResolvedValue([{ ...actual, match: { ...actual.match!, status: 'PLAYED', homeScore: 25, awayScore: 0 } }]);
  await click('Resultado');
  const form = document.querySelector('form')!;
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(saveMatchResult).toHaveBeenCalledWith(500, 25, 0);
  expect(container.textContent).toContain('25 - 0');
});

it('redistributes existing games and refreshes court counts', async () => {
  vi.mocked(redistributeTournamentCourts).mockResolvedValue([{ ...slot, courtId: 2, court: courts[1] }]);
  await click('Sedes');
  await click('Completar sin cambiar horarios');
  expect(redistributeTournamentCourts).toHaveBeenCalledWith(1);
  expect(container.querySelector('[aria-label="Canchas de la sede"]')?.textContent).toContain('Cancha 2 (1)');
  expect(container.querySelector('[role="status"]')?.textContent).toContain('Se conservaron los horarios');
});

it('keeps existing assignments visible if redistribution fails', async () => {
  vi.mocked(redistributeTournamentCourts).mockRejectedValue(new Error('No hay una cancha activa disponible'));
  await click('Sedes');
  await click('Completar sin cambiar horarios');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('No hay una cancha activa disponible');
  expect(container.querySelector('[aria-label="Canchas de la sede"]')?.textContent).toContain('Cancha 1 (1)');
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

it('edits the court and time together from the match dialog', async () => {
  await click('Horario');
  const form = document.querySelector('form')!;
  const court = form.querySelector('select')!;
  await act(async () => { court.value = '2'; court.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(updateTournamentScheduleSlot).toHaveBeenCalledWith(10, { courtId: 2, scheduledAt: new Date(slot.scheduledAt!).toISOString() });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
