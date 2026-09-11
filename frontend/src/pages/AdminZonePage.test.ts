import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminZonePage } from './AdminZonePage';
import { assignZonePlace, generateZoneFixture, getAvailableZoneRegistrations, getZone, getZoneMatches } from '../lib/api';

vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: { role: 'DIRECTOR' } }) }));
vi.mock('../lib/api', () => ({ assignZonePlace: vi.fn(), generateZoneFixture: vi.fn(), getAvailableZoneRegistrations: vi.fn(), getZone: vi.fn(), getZoneMatches: vi.fn(), saveMatchResult: vi.fn(), updateMatchSchedule: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  vi.mocked(getZone).mockResolvedValue({ id: 1, name: 'A', capacity: 4, entries: [], tournamentCategoryId: 2, tournamentCategory: { category: { name: 'Damas A' } } } as never);
  vi.mocked(getZoneMatches).mockResolvedValue([]);
  vi.mocked(getAvailableZoneRegistrations).mockResolvedValue([{ id: 10, playerOneName: 'One', playerTwoName: 'Two', localityName: 'Junin' }] as never);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });
async function render() {
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ['/app/zonas/1'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(Routes, null, createElement(Route, { path: '/app/zonas/:id', element: createElement(AdminZonePage) })))));
}
it('lets the director generate an empty zone and assign a particular placeholder', async () => {
  await render();
  const generate = container.querySelector('.panel-header button') as HTMLButtonElement;
  expect(generate.disabled).toBe(false);
  expect(container.querySelectorAll('select')).toHaveLength(4);
  await act(async () => generate.click());
  expect(generateZoneFixture).toHaveBeenCalledWith(1);
  const select = container.querySelector('select[aria-label="Asignar pareja 3"]') as HTMLSelectElement;
  await act(async () => { select.value = '10'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => (select.parentElement!.querySelector('button') as HTMLButtonElement).click());
  expect(assignZonePlace).toHaveBeenCalledWith(1, 3, 10);
});
it('shows place labels separately from result-dependent participants and keeps pending games unscored', async () => {
  vi.mocked(getZoneMatches).mockResolvedValue([
    { id: 11, matchOrder: 1, status: 'PENDING', homeSource: 'DIRECT', awaySource: 'DIRECT', homeRegistration: null, awayRegistration: null, homeScore: null, scheduledAt: null },
    { id: 12, matchOrder: 2, status: 'PENDING', homeSource: 'DIRECT', awaySource: 'DIRECT', homeRegistration: null, awayRegistration: null, homeScore: null, scheduledAt: null },
    { id: 13, matchOrder: 3, status: 'PENDING', homeSource: 'WINNER', homeSourceMatchId: 11, awaySource: 'LOSER', awaySourceMatchId: 12, homeRegistration: null, awayRegistration: null, homeScore: null, scheduledAt: null },
    { id: 14, matchOrder: 4, status: 'PENDING', homeSource: 'WINNER', homeSourceMatchId: 12, awaySource: 'LOSER', awaySourceMatchId: 11, homeRegistration: null, awayRegistration: null, homeScore: null, scheduledAt: null },
  ] as never);
  await render();
  expect(container.textContent).toContain('Pareja 1 · A definir');
  expect(container.textContent).toContain('Ganadora P1');
  expect(container.textContent).toContain('Perdedora P2');
  expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'Resultado')).toBe(false);
  expect((container.querySelector('.panel-header button') as HTMLButtonElement).disabled).toBe(true);
});
