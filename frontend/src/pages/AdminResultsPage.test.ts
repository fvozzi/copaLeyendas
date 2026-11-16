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
  const played = { ...slot, match: { ...slot.match!, status: 'PLAYED', homeScore: 25, awayScore: 12, resultSourcePhotoAvailable: true, resultPhotoAvailable: true } } as TournamentScheduleSlot;
  const corrected = { ...played, match: { ...played.match!, awayScore: 10 } } as TournamentScheduleSlot;
  vi.mocked(getTournamentOperations).mockResolvedValueOnce(operations(slot)).mockResolvedValueOnce(operations(inProgress)).mockResolvedValueOnce(operations(played)).mockResolvedValueOnce(operations(corrected));
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
  expect(input.required).toBe(false);
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
  const [homeScore, awayScore] = [...form.querySelectorAll<HTMLInputElement>('input[type="number"]')];
  expect([homeScore.value, awayScore.value]).toEqual(['', '']);
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(saveMatchResult).not.toHaveBeenCalled();
  const setValue = (input: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  await act(async () => setValue(homeScore, '25'));
  await act(async () => setValue(awayScore, '12'));
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(saveMatchResult).toHaveBeenCalledWith(80, 25, 12, undefined);
  const editButton = [...container.querySelectorAll('button')].find((item) => item.textContent === 'Editar resultado')!;
  await act(async () => editButton.click());
  form = document.querySelector('form')!;
  const correctionInputs = [...form.querySelectorAll<HTMLInputElement>('input[type="number"]')];
  expect(correctionInputs.map((input) => input.value)).toEqual(['25', '12']);
  await act(async () => setValue(correctionInputs[1], '10'));
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(saveMatchResult).toHaveBeenLastCalledWith(80, 25, 10, undefined);
  expect(openMatchResultPhoto).not.toHaveBeenCalled();
});

it('shows in-progress matches first, then startable matches, ordered by match number', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const court = { id: 3, name: 'Cancha 3', venue: { name: 'Club' } } as Court;
  const otherCourt = { id: 4, name: 'Cancha 4', venue: { name: 'Club' } } as Court;
  const base = { id: 8, matchId: 80, tournamentId: 1, tournamentCategoryId: 2, tournamentCategory: { pointsPerSet: 25, category: { name: 'Damas A' } }, stage: 'ZONE', zoneName: 'Zona A', matchOrder: 1, courtId: 3, court, scheduledAt: '2026-11-20T13:00:00Z' } as TournamentScheduleSlot;
  const slots = [
    { ...base, id: 81, matchId: 81, sequence: 8, match: { id: 81, status: 'PENDING' } },
    { ...base, id: 82, matchId: 82, sequence: 4, courtId: 4, court: otherCourt, match: { id: 82, status: 'READY' } },
    { ...base, id: 83, matchId: 83, sequence: 2, match: { id: 83, status: 'READY' } },
    { ...base, id: 84, matchId: 84, sequence: 1, match: { id: 84, status: 'IN_PROGRESS' } },
  ] as TournamentScheduleSlot[];
  vi.mocked(getTournamentOperations).mockResolvedValue({ tournament: { id: 1, name: 'Copa' }, courts: [court, otherCourt], slots } as TournamentOperations);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(AdminResultsPage)));

  expect(container.querySelector('.result-court-selector select')).toBeNull();
  expect(container.textContent).toContain('Todos los partidos de la sede');
  expect(container.textContent).toContain('Club · Cancha 4');
  expect([...container.querySelectorAll('tbody tr')].map((row) => row.querySelector('[data-label="Partido"]')?.textContent)).toEqual([
    'P1 · Damas A', 'P2 · Damas A', 'P4 · Damas A', 'P8 · Damas A',
  ]);
});

it('closes the start form when the upload response is lost but the match did start', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const court = { id: 3, name: 'Cancha 3', venue: { name: 'Club' } } as Court;
  const slot = { id: 8, matchId: 80, tournamentId: 1, tournamentCategoryId: 2, tournamentCategory: { pointsPerSet: 25, category: { name: 'Damas A' } }, stage: 'ZONE', zoneName: 'Zona A', matchOrder: 1, sequence: 4, courtId: 3, court, scheduledAt: '2026-11-20T13:00:00Z', match: { id: 80, matchOrder: 1, status: 'READY', homeRegistration: { playerOneName: 'Ana', playerTwoName: 'Bea', locality: { name: 'Junín' } }, awayRegistration: { playerOneName: 'Cata', playerTwoName: 'Dora', locality: { name: 'Salta' } }, homeScore: null, awayScore: null, scheduledAt: null } } as TournamentScheduleSlot;
  const inProgress = { ...slot, match: { ...slot.match!, status: 'IN_PROGRESS', resultPhotoAvailable: true } } as TournamentScheduleSlot;
  vi.mocked(getTournamentOperations)
    .mockResolvedValueOnce({ tournament: { id: 1, name: 'Copa' }, courts: [court], slots: [slot] } as TournamentOperations)
    .mockResolvedValueOnce({ tournament: { id: 1, name: 'Copa' }, courts: [court], slots: [inProgress] } as TournamentOperations);
  vi.mocked(startMatch).mockRejectedValueOnce(new Error('Se perdió la respuesta del servidor'));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(AdminResultsPage)));

  const startButton = [...container.querySelectorAll('button')].find((item) => item.textContent === 'Iniciar partido')!;
  await act(async () => startButton.click());
  const form = document.querySelector('form')!;
  const photo = new File(['foto'], 'inicio.jpg', { type: 'image/jpeg' });
  const input = form.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [photo] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

  expect(document.querySelector('form')).toBeNull();
  expect(container.textContent).toContain('P4 iniciado correctamente');
  expect(container.textContent).toContain('En juego');
  expect(container.textContent).not.toContain('Se perdió la respuesta');
});

it('asks for the original photo when correcting a legacy result', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const court = { id: 3, name: 'Cancha 3', venue: { name: 'Club' } } as Court;
  const slot = { id: 8, matchId: 80, tournamentId: 1, tournamentCategoryId: 2, tournamentCategory: { pointsPerSet: 25, category: { name: 'Damas A' } }, stage: 'ZONE', zoneName: 'Zona A', matchOrder: 1, sequence: 3, courtId: 3, court, scheduledAt: '2026-11-20T13:00:00Z', match: { id: 80, matchOrder: 1, status: 'PLAYED', homeRegistration: { playerOneName: 'Ana', playerTwoName: 'Bea', locality: { name: 'Junín' } }, awayRegistration: { playerOneName: 'Cata', playerTwoName: 'Dora', locality: { name: 'Salta' } }, homeScore: 25, awayScore: 12, resultPhotoAvailable: true, resultSourcePhotoAvailable: false } } as TournamentScheduleSlot;
  const operations = { tournament: { id: 1, name: 'Copa' }, courts: [court], slots: [slot] } as TournamentOperations;
  vi.mocked(getTournamentOperations).mockResolvedValue(operations);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(AdminResultsPage)));

  const editButton = [...container.querySelectorAll('button')].find((item) => item.textContent === 'Editar resultado')!;
  await act(async () => editButton.click());
  const form = document.querySelector('form')!;
  const photoInput = form.querySelector<HTMLInputElement>('input[type="file"]')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])')!;
  expect(photoInput.required).toBe(true);
  expect(form.textContent).toContain('Seleccionala nuevamente');
  expect(submit.disabled).toBe(true);

  const original = new File(['foto limpia'], 'original.jpg', { type: 'image/jpeg' });
  Object.defineProperty(photoInput, 'files', { value: [original] });
  await act(async () => photoInput.dispatchEvent(new Event('change', { bubbles: true })));
  expect(submit.disabled).toBe(false);
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(saveMatchResult).toHaveBeenCalledWith(80, 25, 12, original);
});
