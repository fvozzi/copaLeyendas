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
  expect(applyProgramScenario).not.toHaveBeenCalled();
  await click('Aplicar escenario');
  expect(applyProgramScenario).toHaveBeenCalledWith(1, expect.objectContaining({ baseVersion: result.baseVersion }));
  expect(onApplied).toHaveBeenCalledWith(fixture.slots);
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
it('shows capacity problems and prevents applying an incomplete scenario', async () => {
  vi.mocked(previewProgramScenario).mockResolvedValue({ ...result, warnings: [{ sequence: 1, message: 'No entra en la sede ese día.' }] });
  await click('Calcular vista previa');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('No entra en la sede');
  expect(button('Aplicar escenario').disabled).toBe(true);
  expect(applyProgramScenario).not.toHaveBeenCalled();
});
