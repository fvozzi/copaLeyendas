import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getPublicTeamCuilRoster, updatePublicTeamCuilRoster } from '../lib/api';
import { TeamCuilPage } from './TeamCuilPage';

vi.mock('../lib/api', () => ({ getPublicTeamCuilRoster: vi.fn(), updatePublicTeamCuilRoster: vi.fn() }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getPublicTeamCuilRoster).mockResolvedValue({
    teamName: 'Junin', categoryName: 'Damas A', players: [
      { id: 1, fullName: 'Ana Uno', maskedDni: '*****678', completed: false, cuilLastDigits: null },
      { id: 2, fullName: 'Berta Dos', maskedDni: '*****321', completed: true, cuilLastDigits: '219' },
    ],
  });
  vi.mocked(updatePublicTeamCuilRoster).mockResolvedValue({ success: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

it('loads the token roster and sends only CUIL data without reopening the registration', async () => {
  await act(async () => root.render(createElement(MemoryRouter, {
    initialEntries: ['/cuil?token=COPA-TEST'], future: { v7_startTransition: true, v7_relativeSplatPath: true },
  }, createElement(TeamCuilPage))));
  expect(getPublicTeamCuilRoster).toHaveBeenCalledWith('COPA-TEST');
  expect(container.textContent).toContain('Ana Uno');
  expect(container.textContent).toContain('termina en 219');
  const input = container.querySelector<HTMLInputElement>('input[aria-label="CUIL de Ana Uno"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '20-12345678-6');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(updatePublicTeamCuilRoster).toHaveBeenCalledWith('COPA-TEST', [
    { playerId: 1, cuil: '20-12345678-6' }, { playerId: 2, cuil: '' },
  ]);
  expect(container.textContent).toContain('Los CUIL quedaron guardados');
});
