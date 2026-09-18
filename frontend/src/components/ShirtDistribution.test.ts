import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { ShirtDistribution } from './ShirtDistribution';

let root: Root;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it('opens the players in the double-clicked model and supports the model button and total', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const models = ['Guastavino Color 1', 'Dabber Color 3'].map((name, index) => ({ name, total: 1, sizes: { M: 1 }, players: [{ registrationId: index + 1, position: index ? 'playerThree' : 'playerOne', name: index ? 'Beatriz' : 'Ana', size: 'M', team: 'Junín', category: 'Damas A', brand: index ? 'Dabber' : 'Guastavino' }] }));
  await act(async () => root.render(createElement(ShirtDistribution, { distribution: { sizes: ['M'], totals: { M: 2 }, total: 2, models } })));
  await act(async () => container.querySelector('.shirt-distribution-table tbody tr')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  let dialog = container.querySelector('[role="dialog"]')!;
  expect(dialog.getAttribute('aria-label')).toBe('Guastavino Color 1');
  expect(dialog.textContent).toContain('Ana');
  expect(dialog.textContent).not.toContain('Beatriz');
  expect(dialog.textContent).toContain('Junín');
  await act(async () => (dialog.querySelector('.dialog-close') as HTMLButtonElement).click());
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => (container.querySelectorAll('.shirt-detail-button')[1] as HTMLButtonElement).click());
  dialog = container.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('Beatriz');
  expect(dialog.textContent).toContain('Suplente');
  await act(async () => (dialog.querySelector('.dialog-close') as HTMLButtonElement).click());
  await act(async () => container.querySelector('.shirt-distribution-table tfoot tr')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  expect(container.querySelectorAll('.shirt-players-table tbody tr')).toHaveLength(2);
});
