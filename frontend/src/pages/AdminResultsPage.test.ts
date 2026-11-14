import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminResultsPage } from './AdminResultsPage';
import { getTournamentOperations, openMatchResultPhoto, saveMatchResult, startMatch } from '../lib/api';
import type { Court, TournamentOperations, TournamentScheduleSlot } from '../types';

vi.mock('../lib/api', () => ({ getTournamentOperations: vi.fn(), openMatchResultPhoto: vi.fn(), saveMatchResult: vi.fn(), startMatch: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.resetAllMocks(); });

it('lets a court leader start with a photo and then submit a 25-point result', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const court = { id: 3, name: 'Cancha 3', venue: { name: 'Club' } } as Court;
  const slot = { id: 8, matchId: 80, tournamentId: 1, tournamentCategoryId: 2, tournamentCategory: { pointsPerSet: 25, category: { name: 'Damas A' } }, stage: 'ZONE', zoneName: 'Zona A', matchOrder: 1, sequence: 4, courtId: 3, court, scheduledAt: '2026-11-20T13:00:00Z', match: { id: 80, matchOrder: 1, status: 'READY', homeRegistration: { playerOneName: 'Ana', playerTwoName: 'Bea', locality: { name: 'Junín' } }, awayRegistration: { playerOneName: 'Cata', playerTwoName: 'Dora', locality: { name: 'Salta' } }, homeScore: null, awayScore: null, scheduledAt: null } } as TournamentScheduleSlot;
  const operations = (current: TournamentScheduleSlot) => ({ tournament: { id: 1, name: 'Copa', startsAt: '2026-11-20', endsAt: '2026-11-21' }, courts: [court], slots: [current] } as TournamentOperations);
  const inProgress = { ...slot, match: { ...slot.match!, status: 'IN_PROGRESS', resultPhotoAvailable: true } } as TournamentScheduleSlot;
  const played = { ...slot, match: { ...slot.match!, status: 'PLAYED', homeScore: 25, awayScore: 0, resultPhotoAvailable: true } } as TournamentScheduleSlot;
  vi.mocked(getTournamentOperations).mockResolvedValueOnce(operations(slot)).mockResolvedValueOnce(operations(inProgress)).mockResolvedValueOnce(operations(played));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(AdminResultsPage)));
  expect(container.textContent).toContain('Club · Cancha 3');
  expect(container.textContent).toContain('Junín · Ana / Bea');
  const startButton = [...container.querySelectorAll('button')].find((item) => item.textContent === 'Iniciar partido')!;
  await act(async () => startButton.click());
  let form = document.querySelector('form')!;
  expect(form.textContent).toContain('Sacar foto con la cámara');
  const photo = new File(['foto'], 'tablero.jpg', { type: 'image/jpeg' });
  const input = form.querySelector<HTMLInputElement>('input[type="file"]')!;
  expect(input.accept).toBe('image/*');
  expect(input.getAttribute('capture')).toBe('environment');
  Object.defineProperty(input, 'files', { value: [photo] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  expect(form.textContent).toContain('Foto lista para publicar');
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(startMatch).toHaveBeenCalledWith(80, photo);
  expect(container.textContent).toContain('En juego');
  const resultButton = [...container.querySelectorAll('button')].find((item) => item.textContent === 'Cargar resultado')!;
  await act(async () => resultButton.click());
  form = document.querySelector('form')!;
  expect(form.querySelector('input[type="file"]')).toBeNull();
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(saveMatchResult).toHaveBeenCalledWith(80, 25, 0);
  expect(openMatchResultPhoto).not.toHaveBeenCalled();
});
