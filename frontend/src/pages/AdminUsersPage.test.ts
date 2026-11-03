import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminUsersPage } from './AdminUsersPage';
import { createUser, deleteUser, getUsers, updateUser } from '../lib/api';

vi.mock('../lib/api', () => ({ createUser: vi.fn(), deleteUser: vi.fn(), getUsers: vi.fn(), updateUser: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.resetAllMocks(); });

it('shows a create error inside the open user dialog', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getUsers).mockResolvedValue([]);
  vi.mocked(createUser).mockRejectedValue(new Error('No se pudo crear el líder.'));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(AdminUsersPage)));
  const add = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Agregar usuario')!;
  await act(async () => add.click());
  const form = document.querySelector('form')!;
  const inputs = form.querySelectorAll<HTMLInputElement>('input');
  await act(async () => {
    inputs[0].value = 'Responsable'; inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'responsable@example.com'; inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[2].value = 'segura123'; inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog).toBeTruthy();
  expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('No se pudo crear el líder.');
  expect(deleteUser).not.toHaveBeenCalled(); expect(updateUser).not.toHaveBeenCalled();
});
