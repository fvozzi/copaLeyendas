import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminLocalitiesPage } from './AdminLocalitiesPage';
import { createLocality, deleteLocality, getCategories, getLocalities, updateLocality } from '../lib/api';

vi.mock('../lib/api', () => ({
  createLocality: vi.fn(), deleteLocality: vi.fn(), getCategories: vi.fn(), getLocalities: vi.fn(), updateLocality: vi.fn(),
}));

const locality = { id: 12, name: 'Comodoro', provinceName: 'Chubut', active: true, categoryId: 1, category: { id: 1, name: 'Damas A', active: true } };
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  vi.mocked(getLocalities).mockResolvedValue([locality] as never);
  vi.mocked(getCategories).mockResolvedValue([locality.category] as never);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });

async function render() { await act(async () => root.render(createElement(AdminLocalitiesPage))); }
function action(label: string) { return [...container.querySelectorAll('tbody button')].find((button) => button.textContent === label) as HTMLButtonElement; }

it('renames the selected locality through PATCH without creating another row', async () => {
  vi.mocked(updateLocality).mockResolvedValue({ ...locality, name: 'Comodoro Rivadavia' } as never);
  vi.mocked(getLocalities).mockResolvedValueOnce([locality] as never).mockResolvedValueOnce([{ ...locality, name: 'Comodoro Rivadavia' }] as never);
  await render();
  await act(async () => action('Editar').click());
  const name = container.querySelector('input[value="Comodoro"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Comodoro Rivadavia');
    name.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => (container.querySelector('form button[type="submit"]') as HTMLButtonElement).click());
  expect(updateLocality).toHaveBeenCalledWith(12, expect.objectContaining({ name: 'Comodoro Rivadavia' }));
  expect(createLocality).not.toHaveBeenCalled();
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
});

it('shows a failed deletion beside the affected team', async () => {
  vi.mocked(deleteLocality).mockRejectedValue(new Error('Tiene inscripciones asociadas'));
  await render();
  await act(async () => action('Eliminar').click());
  expect(deleteLocality).not.toHaveBeenCalled();
  await act(async () => (container.querySelector('[role="dialog"] .primary-button') as HTMLButtonElement).click());
  expect(deleteLocality).toHaveBeenCalledWith(12);
  expect(container.querySelector('tbody [role="alert"]')?.textContent).toContain('Tiene inscripciones asociadas');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
});

it('removes a deleted team from the list', async () => {
  vi.mocked(deleteLocality).mockResolvedValue({ success: true });
  vi.mocked(getLocalities).mockResolvedValueOnce([locality] as never).mockResolvedValueOnce([]);
  await render();
  await act(async () => action('Eliminar').click());
  await act(async () => (container.querySelector('[role="dialog"] .primary-button') as HTMLButtonElement).click());
  expect(container.textContent).toContain('Se elimino Comodoro, Chubut.');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
});
