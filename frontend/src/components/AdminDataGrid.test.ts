import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { AdminDataGrid } from './AdminDataGrid';

interface TestRow { id: number; name: string }
const TestGrid = AdminDataGrid<TestRow>;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it('lets card-style mobile grids sort without exposing the hidden table header', async () => {
  await act(async () => root.render(createElement(TestGrid, {
    rows: [{ id: 1, name: 'Zárate' }, { id: 2, name: 'Allende' }],
    columns: [{ label: 'Equipo', render: (row: TestRow) => row.name }],
    emptyMessage: 'Sin equipos',
  })));

  const select = container.querySelector('.admin-grid-mobile-sort select') as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, '0');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect([...container.querySelectorAll('tbody tr')].map((row) => row.textContent)).toEqual(['Allende', 'Zárate']);

  await act(async () => (container.querySelector('.admin-grid-mobile-sort button') as HTMLButtonElement).click());
  expect([...container.querySelectorAll('tbody tr')].map((row) => row.textContent)).toEqual(['Zárate', 'Allende']);
});
