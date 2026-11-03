import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminResultsPage } from './AdminResultsPage';
import { getTournamentOperations, openMatchResultPhoto, saveMatchResult } from '../lib/api';
import type { Court, TournamentOperations, TournamentScheduleSlot } from '../types';

vi.mock('../lib/api', () => ({ getTournamentOperations: vi.fn(), openMatchResultPhoto: vi.fn(), saveMatchResult: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.resetAllMocks(); });

it('lets a court leader choose an assigned court and submit a 25-point result with a photo', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const court = { id: 3, name: 'Cancha 3', venue: { name: 'Club' } } as Court;
  const slot = { id: 8, matchId: 80, tournamentId: 1, tournamentCategoryId: 2, tournamentCategory: { pointsPerSet: 25, category: { name: 'Damas A' } }, stage: 'ZONE', zoneName: 'Zona A', matchOrder: 1, sequence: 4, courtId: 3, court, scheduledAt: '2026-11-20T13:00:00Z', match: { id: 80, matchOrder: 1, status: 'READY', homeRegistration: { playerOneName: 'Ana', playerTwoName: 'Bea', locality: { name: 'Junín' } }, awayRegistration: { playerOneName: 'Cata', playerTwoName: 'Dora', locality: { name: 'Salta' } }, homeScore: null, awayScore: null, scheduledAt: null } } as TournamentScheduleSlot;
  vi.mocked(getTournamentOperations).mockResolvedValue({ tournament: { id: 1, name: 'Copa', startsAt: '2026-11-20', endsAt: '2026-11-21' }, courts: [court], slots: [slot] } as TournamentOperations);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(AdminResultsPage)));
  expect(container.textContent).toContain('Club · Cancha 3');
  expect(container.textContent).toContain('Junín · Ana / Bea');
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === 'Cargar resultado')!;
  await act(async () => button.click());
  const form = document.querySelector('form')!;
  const photo = new File(['foto'], 'tablero.jpg', { type: 'image/jpeg' });
  const input = form.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [photo] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(saveMatchResult).toHaveBeenCalledWith(80, 25, 0, photo);
  expect(openMatchResultPhoto).not.toHaveBeenCalled();
});
