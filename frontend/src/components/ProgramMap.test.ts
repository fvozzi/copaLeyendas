import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProgramMap } from './ProgramMap';
import { programMapFixture } from '../test/program-map-fixture';
import { assignZonePlace, getAvailableZoneRegistrations, getTournament, getZone, updateTournamentZone } from '../lib/api';

vi.mock('../lib/api', () => ({ getTournament: vi.fn(), getZone: vi.fn(), getAvailableZoneRegistrations: vi.fn(), updateTournamentZone: vi.fn(), assignZonePlace: vi.fn() }));
let container: HTMLDivElement; let root: Root;
let fixture: ReturnType<typeof programMapFixture>;
const onChanged = vi.fn(async () => {}), onMatch = vi.fn();
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  fixture = programMapFixture();
  vi.mocked(getTournament).mockResolvedValue(fixture.tournament);
  vi.mocked(getZone).mockResolvedValue({ ...fixture.tournament.zones[0], entries: [] });
  vi.mocked(getAvailableZoneRegistrations).mockResolvedValue([{ id: 900, playerOneName: 'Ana', playerTwoName: 'Bea', localityName: 'Junin' }] as never);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(ProgramMap, { tournamentId: 1, slots: fixture.slots, venues: fixture.venues, busy: false, onChanged, onMatch })));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });
async function change(label: string, value: string) { const select = document.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!; await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); }); }

it('combines category and venue filters and draws the connected bracket', async () => {
  expect(container.querySelectorAll('[data-map-node^="zone-"]')).toHaveLength(8);
  expect(container.querySelectorAll('[data-map-edge]')).toHaveLength(28);
  await change('Filtrar mapa por sede', '1');
  expect(container.querySelectorAll('[data-map-node^="zone-"]')).toHaveLength(4);
  await change('Filtrar mapa por categoría', '2');
  expect(container.querySelectorAll('[data-map-node^="zone-"]')).toHaveLength(2);
  expect(container.querySelectorAll('[aria-label^="Mapa de"]')).toHaveLength(1);
  expect(container.querySelector('[aria-label="Mapa de Damas B"]')).toBeTruthy();
});
it('opens a real match from the graph', async () => {
  const slot = fixture.slots.find((item) => item.stage === 'QUARTERFINAL')!;
  await act(async () => (container.querySelector(`[data-map-node="match-${slot.matchId}"]`) as HTMLButtonElement).click());
  expect(onMatch).toHaveBeenCalledWith(slot, 'schedule');
});

it('renders the same graph publicly without admin requests or editing controls, including score updates', async () => {
  vi.mocked(getTournament).mockClear();
  await act(async () => root.render(createElement(ProgramMap, { readOnly: true, detail: fixture.tournament, slots: fixture.slots, venues: fixture.venues })));
  expect(getTournament).not.toHaveBeenCalled();
  expect(container.querySelectorAll('[data-map-edge]')).toHaveLength(28);
  expect(container.querySelectorAll('button.map-node')).toHaveLength(0);
  expect(container.querySelectorAll('.map-node-action')).toHaveLength(0);
  expect(container.textContent).not.toContain('para editar');
  await act(async () => (container.querySelector('[data-map-node="zone-1"]') as HTMLElement).click());
  expect(getZone).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  const slot = fixture.slots.find(item => item.stage === 'QUARTERFINAL')!;
  slot.match = { ...slot.match!, status: 'PLAYED', homeScore: 21, awayScore: 18 };
  await act(async () => root.render(createElement(ProgramMap, { readOnly: true, detail: fixture.tournament, slots: [...fixture.slots], venues: fixture.venues })));
  expect(container.querySelector(`[data-map-node="match-${slot.matchId}"]`)?.textContent).toContain('21–18');
  await change('Filtrar mapa por categoría', '2');
  expect(container.querySelectorAll('[data-map-node^="zone-"]')).toHaveLength(4);
});

it('lists placeholders and replaces only the assigned pair with player names', async () => {
  const zoneCard = container.querySelector('[data-map-node="zone-1"]')!;
  expect([...zoneCard.querySelectorAll('.map-pair-name')].map((item) => item.textContent)).toEqual(['Pareja 1', 'Pareja 2', 'Pareja 3', 'Pareja 4']);
  fixture.slots[0].match!.awayRegistration = { id: 900, playerOneName: 'Ana Perez', playerTwoName: 'Bea Gomez' } as never;
  await act(async () => root.render(createElement(ProgramMap, { tournamentId: 1, slots: [...fixture.slots], venues: fixture.venues, busy: false, onChanged, onMatch })));
  expect([...zoneCard.querySelectorAll('.map-pair-name')].map((item) => item.textContent)).toEqual(['Pareja 1', 'Ana Perez / Bea Gomez', 'Pareja 3', 'Pareja 4']);
  expect(zoneCard.textContent).toContain('1/4 parejas');
});
it('edits a zone and assigns a pair from the map using existing endpoints', async () => {
  await act(async () => (container.querySelector('[data-map-node="zone-1"]') as HTMLButtonElement).click());
  const form = document.querySelector('form')!;
  const venue = form.querySelector('select')!;
  await act(async () => { venue.value = '2'; venue.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(updateTournamentZone).toHaveBeenCalledWith(1, { name: 'A', venueId: 2, capacity: 4 });
  expect(onChanged).toHaveBeenCalledOnce();
  await change('Pareja 1 de zona A', '900');
  const assign = document.querySelector('.map-zone-places button') as HTMLButtonElement;
  await act(async () => assign.click());
  expect(assignZonePlace).toHaveBeenCalledWith(1, 1, 900);
});

it('keeps the zone editor open and the map unchanged when a venue move conflicts', async () => {
  vi.mocked(updateTournamentZone).mockRejectedValueOnce(new Error('La cancha ya tiene un partido en ese horario.'));
  await act(async () => (container.querySelector('[data-map-node="zone-1"]') as HTMLButtonElement).click());
  const form = document.querySelector('form')!;
  const venue = form.querySelector('select')!;
  await act(async () => { venue.value = '2'; venue.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('La cancha ya tiene un partido');
  expect(container.querySelector('[data-map-node="zone-1"]')?.textContent).toContain('Ciudad de Buenos Aires');
  expect(onChanged).not.toHaveBeenCalled();
});
