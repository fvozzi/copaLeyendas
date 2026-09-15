import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ProgramScenarioDialog } from './ProgramScenarioDialog';
import { applyProgramScenario, getTournament, getTournamentScheduleGrid, previewProgramScenario } from '../lib/api';
import { programMapFixture } from '../test/program-map-fixture';

vi.mock('../lib/api', () => ({ getTournament: vi.fn(), getTournamentScheduleGrid: vi.fn(), previewProgramScenario: vi.fn(), applyProgramScenario: vi.fn() }));
let root: Root, container: HTMLDivElement;
const fixture = programMapFixture();
const onApplied = vi.fn(), onClose = vi.fn();
const result = { slots: fixture.slots, warnings: [], baseVersion: 'a'.repeat(64) };
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getTournament).mockResolvedValue({ ...fixture.tournament, playingDays: ['2026-11-20', '2026-11-21'] });
  vi.mocked(getTournamentScheduleGrid).mockResolvedValue(fixture.slots);
  vi.mocked(previewProgramScenario).mockResolvedValue(result);
  vi.mocked(applyProgramScenario).mockResolvedValue(result);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(ProgramScenarioDialog, { tournamentId: 1, venues: fixture.venues, courts: fixture.courts, onClose, onApplied })));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); });
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text)!;
const click = async (text: string) => act(async () => button(text).click());
it('loads every zone and knockout stage and applies only after preview', async () => {
  expect(container.querySelectorAll('.scenario-rule')).toHaveLength(22);
  expect(button('Aplicar escenario')).toBeUndefined();
  const semi = container.querySelector<HTMLSelectElement>('[aria-label="Día: Damas A · Semifinales 1"]')!;
  await act(async () => { semi.value = 'FINALS'; semi.dispatchEvent(new Event('change', { bubbles: true })); });
  await click('Calcular vista previa');
  expect(previewProgramScenario).toHaveBeenCalledWith(1, expect.objectContaining({ mainDay: '2026-11-20', finalsDay: '2026-11-21', rules: expect.arrayContaining([expect.objectContaining({ categoryId: 1, stage: 'SEMIFINAL', day: 'FINALS' })]) }));
  expect(vi.mocked(previewProgramScenario).mock.calls[0][1].rules.every((rule) => rule.courtId === null)).toBe(true);
  expect(applyProgramScenario).not.toHaveBeenCalled();
  await click('Aplicar escenario');
  expect(applyProgramScenario).toHaveBeenCalledWith(1, expect.objectContaining({ baseVersion: result.baseVersion }));
  expect(onApplied).toHaveBeenCalledWith(fixture.slots);
});

it('allows explicitly fixing a court without locking the other zones and knockout games', async () => {
  const court = container.querySelector<HTMLSelectElement>('[aria-label="Cancha: Damas A · Zona A"]')!;
  expect(court.value).toBe('0');
  await act(async () => { court.value = '1'; court.dispatchEvent(new Event('change', { bubbles: true })); });
  await click('Calcular vista previa');
  const rules = vi.mocked(previewProgramScenario).mock.calls[0][1].rules;
  expect(rules.filter((rule) => rule.courtId !== null)).toEqual([expect.objectContaining({ stage: 'ZONE', categoryId: 1, courtId: 1 })]);
});
it('invalidates the preview when a setting changes and keeps all rules when filtering', async () => {
  const filter = container.querySelector<HTMLSelectElement>('[aria-label="Categoría del escenario"]')!;
  await act(async () => { filter.value = '1'; filter.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.querySelectorAll('.scenario-rule')).toHaveLength(11);
  await click('Calcular vista previa');
  expect(vi.mocked(previewProgramScenario).mock.calls[0][1].rules).toHaveLength(22);
  await click('Ajustar escenario');
  await act(async () => container.querySelector<HTMLInputElement>('[type="checkbox"]')!.click());
  expect(button('Aplicar escenario')).toBeUndefined();
  await click('Calcular vista previa');
  expect(vi.mocked(previewProgramScenario).mock.calls[1][1].interleaveCategories).toBe(true);
});
it('shows invalid times and prevents applying an incomplete scenario', async () => {
  vi.mocked(previewProgramScenario).mockResolvedValue({ ...result, warnings: [{ sequence: 1, message: 'No entra en la sede ese día.' }] });
  await click('Calcular vista previa');
  expect(container.querySelector('.scenario-match-warning')?.textContent).toContain('No entra en la sede');
  expect(button('Aplicar escenario').disabled).toBe(true);
  expect(applyProgramScenario).not.toHaveBeenCalled();
});

it('colors excess games, keeps their times visible and allows applying the full scenario', async () => {
  vi.mocked(previewProgramScenario).mockResolvedValue({ ...result, capacityWarnings: [{ sequence: 1, message: 'Supera los 16 turnos previstos.' }] });
  await click('Calcular vista previa');
  expect(container.querySelector('#scenario-match-1')?.classList.contains('over-capacity')).toBe(true);
  expect(container.querySelector('#scenario-match-1')?.textContent).toContain('Supera los 16 turnos');
  expect(container.querySelectorAll('.scenario-match-row')).toHaveLength(result.slots.length);
  expect(container.querySelector('.scenario-preview-summary')?.textContent).toContain('1 fuera de lo previsto');
  expect(button('Aplicar escenario').disabled).toBe(false);
  await click('Aplicar escenario');
  expect(applyProgramScenario).toHaveBeenCalledOnce();
});

it('shows pending games with their planned venue and recalculates a manual time before applying', async () => {
  vi.mocked(previewProgramScenario).mockResolvedValueOnce({ ...result, slots: result.slots.map((slot) => slot.sequence === 1 ? { ...slot, scheduledAt: null, courtId: null, court: null } : slot), warnings: [{ sequence: 1, message: 'No hay un turno libre.' }] });
  await click('Calcular vista previa');
  expect(container.querySelectorAll('.scenario-match-row')).toHaveLength(1);
  expect(container.querySelector('#scenario-match-1')?.textContent).toContain('Ciudad de Buenos Aires');
  expect(container.querySelector('#scenario-match-1')?.textContent).toContain('Sin horario válido');
  await click('Editar horario');
  const form = container.querySelector('form')!;
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(vi.mocked(previewProgramScenario).mock.calls[1][1].overrides).toEqual([{ sequence: 1, courtId: 1, scheduledAt: '2026-11-20T13:00:00.000Z' }]);
  expect(applyProgramScenario).not.toHaveBeenCalled();
  await click('Aplicar escenario');
  expect(applyProgramScenario).toHaveBeenCalledWith(1, expect.objectContaining({ overrides: expect.arrayContaining([expect.objectContaining({ sequence: 1, courtId: 1 })]) }));
});

it('disables applying the old preview if recalculating a manual change fails', async () => {
  await click('Calcular vista previa');
  await act(async () => (container.querySelector('#scenario-match-1 button') as HTMLButtonElement).click());
  expect(button('Aplicar escenario').disabled).toBe(true);
  vi.mocked(previewProgramScenario).mockRejectedValueOnce(new Error('No se pudo recalcular.'));
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(button('Aplicar escenario').disabled).toBe(true);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('No se pudo recalcular');
});
