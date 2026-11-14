import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { applyTournamentDistribution, getTournamentDistribution, getTournaments, setTournamentAttendance, setTournamentDistributionLayout, setTournamentDistributionVenue } from '../lib/api';
import { AdminDistributionPage } from './AdminDistributionPage';

vi.mock('../lib/api', () => ({ getTournaments: vi.fn(), getTournamentDistribution: vi.fn(), applyTournamentDistribution: vi.fn(), setTournamentAttendance: vi.fn(), setTournamentDistributionLayout: vi.fn(), setTournamentDistributionVenue: vi.fn() }));

afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); document.body.innerHTML = ''; });

it('shows the assignment rules and applies the preview to the real tournament', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getTournaments).mockResolvedValue([{ id: 1, name: 'Copa', status: 'ACTIVE' }] as never);
  const preview = { tournament: { id: 1, name: 'Copa' }, mode: 'PREVIEW', canApply: true, baseVersion: 'version-1', matchCount: 0, hasResults: false, replacesPendingFixture: false, rules: ['Misma localidad: misma sede y distinta zona.', 'Los partidos son los mismos de Programa - Mapa.'], venues: [{ id: 2, name: 'Sede Norte' }, { id: 3, name: 'Sede Sur' }], attendance: [{ id: 10, localityId: 3, localityName: 'Rocha', label: 'Las Leyendas', tournamentCategoryId: 5, categoryName: 'Damas A', present: true }], plans: [{ tournamentCategoryId: 5, categoryName: 'Damas A', registrationCount: 8, newRegistrationCount: 0, capacities: [4, 4], layoutMode: 'MANUAL', methodology: 'PROVINCE', qualifiersPerZone: 2, nextStage: 'SEMIFINAL', venue: { id: 2, name: 'Sede Norte' }, warnings: [], zones: [{ name: 'Zona A', capacity: 4, venue: { id: 2, name: 'Sede Norte' }, venueAssignment: 'AUTOMATIC', registrations: [{ id: 10, localityId: 3, localityName: 'Rocha', label: 'Las Leyendas' }] }] }] } as const;
  vi.mocked(getTournamentDistribution).mockResolvedValue(preview as never);
  const absentPreview = { ...preview, baseVersion: 'version-2', matchCount: 11, replacesPendingFixture: true, attendance: preview.attendance.map((registration) => ({ ...registration, present: false })), plans: preview.plans.map((plan) => ({ ...plan, registrationCount: 7, capacities: [4, 3] })) } as const;
  vi.mocked(setTournamentAttendance).mockResolvedValue(absentPreview as never);
  vi.mocked(setTournamentDistributionVenue).mockResolvedValue({ ...preview, plans: preview.plans.map((plan) => ({ ...plan, venue: { id: 3, name: 'Sede Sur' }, zones: plan.zones.map((zone) => ({ ...zone, venue: { id: 3, name: 'Sede Sur' }, venueAssignment: 'MANUAL' as const })) })) } as never);
  vi.mocked(applyTournamentDistribution)
    .mockResolvedValueOnce(absentPreview as never)
    .mockResolvedValueOnce({ ...absentPreview, mode: 'CURRENT', canApply: false } as never);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(AdminDistributionPage))));
  expect(container.textContent).toContain('Misma localidad: misma sede y distinta zona.');
  expect(container.textContent).toContain('4 + 4');
  expect(container.textContent).toContain('Las Leyendas');
  const venue = container.querySelector('select[aria-label="Sede de Damas A Zona A"]') as HTMLSelectElement;
  venue.value = '3';
  await act(async () => venue.dispatchEvent(new Event('change', { bubbles: true })));
  expect(setTournamentDistributionVenue).toHaveBeenCalledWith(1, 5, 0, 3);
  expect(container.textContent).toContain('Asignación de Dirección');
  const absent = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Marcar ausente')!;
  await act(async () => absent.click());
  expect(setTournamentAttendance).toHaveBeenCalledWith(1, 10, false);
  expect(container.textContent).toContain('4 + 3');
  const reset = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Rehacer programación desde cero')!;
  await act(async () => reset.click());
  expect(applyTournamentDistribution).toHaveBeenCalledWith(1, 'version-2', true);
  const apply = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Aplicar conservando programación')!;
  await act(async () => apply.click());
  expect(applyTournamentDistribution).toHaveBeenCalledWith(1, 'version-2', false);
  expect(container.textContent).toContain('hay 11 partidos reales');
  await act(async () => root.unmount());
});

it('offers to add newly confirmed pairs without rebuilding the program from scratch', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getTournaments).mockResolvedValue([{ id: 1, name: 'Copa', status: 'ACTIVE' }] as never);
  const preview = {
    tournament: { id: 1, name: 'Copa' }, mode: 'PREVIEW', canApply: true, baseVersion: 'version-9', matchCount: 8, hasResults: false, replacesPendingFixture: true,
    rules: [], venues: [{ id: 2, name: 'Sede' }], attendance: [],
    plans: [{ tournamentCategoryId: 5, categoryName: 'Silvina Cimadamore', registrationCount: 9, newRegistrationCount: 1, capacities: [3, 3, 3], layoutMode: 'MANUAL', methodology: 'PROVINCE', qualifiersPerZone: 2, nextStage: null, venue: { id: 2, name: 'Sede' }, warnings: [], zones: [] }],
  } as const;
  vi.mocked(getTournamentDistribution).mockResolvedValue(preview as never);
  vi.mocked(applyTournamentDistribution).mockResolvedValue({ ...preview, mode: 'CURRENT', canApply: false, replacesPendingFixture: false } as never);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(AdminDistributionPage))));

  expect(container.textContent).toContain('9 parejas confirmadas · 1 nueva');
  expect(container.textContent).toContain('Hay nuevas parejas confirmadas');
  const add = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Sumar nuevas confirmadas')!;
  await act(async () => add.click());
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('conservando al máximo las zonas actuales'));
  expect(applyTournamentDistribution).toHaveBeenCalledWith(1, 'version-9', false);
  await act(async () => root.unmount());
});

it('lets Direction configure four zones of three while only eleven pairs are confirmed', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getTournaments).mockResolvedValue([{ id: 1, name: 'Copa', status: 'ACTIVE' }] as never);
  const preview = {
    tournament: { id: 1, name: 'Copa' }, mode: 'PREVIEW', canApply: true, baseVersion: 'version-11', matchCount: 0, hasResults: false, replacesPendingFixture: false,
    rules: [], venues: [{ id: 2, name: 'Sede' }], attendance: [],
    plans: [{ tournamentCategoryId: 5, categoryName: 'Damas A', registrationCount: 11, newRegistrationCount: 0, capacities: [4, 4, 3], layoutMode: 'AUTOMATIC', methodology: 'PROVINCE', qualifiersPerZone: 2, nextStage: null, venue: { id: 2, name: 'Sede' }, warnings: [], zones: [] }],
  } as const;
  const configured = { ...preview, baseVersion: 'version-12', plans: preview.plans.map((plan) => ({ ...plan, capacities: [3, 3, 3, 3], layoutMode: 'MANUAL' as const })) };
  vi.mocked(getTournamentDistribution).mockResolvedValue(preview as never);
  vi.mocked(setTournamentDistributionLayout).mockResolvedValue(configured as never);
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(AdminDistributionPage))));

  const first = container.querySelector<HTMLSelectElement>('[aria-label="Capacidad de Damas A Zona A"]')!;
  const second = container.querySelector<HTMLSelectElement>('[aria-label="Capacidad de Damas A Zona B"]')!;
  await act(async () => { first.value = '3'; first.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => { second.value = '3'; second.dispatchEvent(new Event('change', { bubbles: true })); });
  const add = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Agregar zona')!;
  await act(async () => add.click());
  const methodology = container.querySelector<HTMLSelectElement>('[aria-label="Metodología de Damas A"]')!;
  await act(async () => { methodology.value = 'ROUND_ROBIN'; methodology.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelector('[aria-label="Configuración de zonas de Damas A"]')?.textContent).toContain('12 lugares para 11 confirmadas · 1 libre');
  expect(container.textContent).toContain('Cuartos de final');
  expect(container.textContent).toContain('cada pareja enfrenta una vez');
  const save = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Fijar configuración')!;
  await act(async () => save.click());

  expect(setTournamentDistributionLayout).toHaveBeenCalledWith(1, 5, [3, 3, 3, 3], 'ROUND_ROBIN', 2);
  expect(container.textContent).toContain('Definido por Dirección');
  expect(container.textContent).toContain('3 + 3 + 3 + 3');
  await act(async () => root.unmount());
});
