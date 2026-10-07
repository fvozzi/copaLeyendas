import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminRegistrationsPage } from './AdminRegistrationsPage';
import { getAccessGrants, getCategories, getLocalities, getRegistrations, updateRegistrationStatus } from '../lib/api';
import type { PairRegistration, RegistrationAccessGrant } from '../types';

vi.mock('../lib/api', () => ({
  createAccessGrant: vi.fn(),
  createLocality: vi.fn(),
  deleteAccessGrant: vi.fn(),
  deleteRegistration: vi.fn(),
  getAccessGrants: vi.fn(),
  getCategories: vi.fn(),
  getLocalities: vi.fn(),
  getRegistrations: vi.fn(),
  openRegistrationPaymentProof: vi.fn(),
  sendAccessGrantTokenByWhatsApp: vi.fn(),
  updateAccessGrantStatus: vi.fn(),
  updateRegistrationStatus: vi.fn(),
}));

let root: Root;
let container: HTMLDivElement;

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

const category = { id: 1, name: 'Damas A', active: true, sortOrder: 1 };
const grantDefaults = {
  categoryId: 1,
  category,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  notes: null,
  feeWaived: false,
  paymentDeferredUntilConfirmed: false,
  whatsappSentAt: null,
  whatsappDelivery: null,
  registrations: [],
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
};
const locality = (id: number, name: string, provinceName = 'Buenos Aires') => ({
  id, name, provinceName, active: true, categoryId: 1, category,
  createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-01T12:00:00.000Z',
});

const grants = [
  { ...grantDefaults, id: 1, token: 'PENDIENTE', localityId: 1, locality: locality(1, 'Equipo pendiente'), status: 'ACTIVE', consumedAt: null },
  { ...grantDefaults, id: 2, token: 'USADO', localityId: 2, locality: locality(2, 'Equipo usado'), status: 'ACTIVE', consumedAt: '2026-09-10T12:00:00.000Z' },
  { ...grantDefaults, id: 3, token: 'REVOCADO', localityId: 3, locality: locality(3, 'Equipo revocado'), status: 'REVOKED', consumedAt: null },
] as RegistrationAccessGrant[];

const registrations = [{
  id: 10,
  playerOneName: 'Ana Uno',
  playerTwoName: 'Berta Dos',
  localityId: 10,
  locality: locality(10, 'Equipo recibido', 'Córdoba'),
  category,
  status: 'RECEIVED',
  feeWaived: false,
  paymentDeferredUntilConfirmed: false,
  paymentProofStoredName: null,
  payments: [],
}] as unknown as PairRegistration[];

async function render() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getAccessGrants).mockResolvedValue(grants);
  vi.mocked(getRegistrations).mockResolvedValue(registrations);
  vi.mocked(getLocalities).mockResolvedValue([]);
  vi.mocked(getCategories).mockResolvedValue([]);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(AdminRegistrationsPage)));
}

it('keeps both registration lists as sortable tables on mobile', async () => {
  await render();
  expect(container.querySelector('.registrations-grants-card .preserve-table-mobile')).toBeTruthy();
  expect(container.querySelector('.registrations-received-card .preserve-table-mobile')).toBeTruthy();
  expect(container.querySelectorAll('.registrations-grants-card .admin-grid-sort')).toHaveLength(8);
  expect(container.querySelectorAll('.registrations-received-card .admin-grid-sort')).toHaveLength(5);
});

it('filters active access grants that have not been used', async () => {
  await render();
  const filter = [...container.querySelectorAll<HTMLButtonElement>('.registration-grant-filters button')]
    .find((button) => button.textContent?.includes('Activos aún no usados'))!;
  expect(filter.textContent).toContain('(1)');
  await act(async () => filter.click());
  const grid = container.querySelector('.registrations-grants-card .admin-data-grid')!;
  expect(grid.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(grid.textContent).toContain('Equipo pendiente');
  expect(grid.textContent).not.toContain('Equipo usado');
  expect(grid.textContent).not.toContain('Equipo revocado');
});

it('allows Direction to waive an existing registration so Caja stops counting it', async () => {
  await render();
  vi.mocked(updateRegistrationStatus).mockResolvedValue({ ...registrations[0], feeWaived: true });
  const edit = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Editar')!;
  await act(async () => edit.click());
  const dialog = document.querySelector('[role="dialog"]')!;
  const waived = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  expect(waived.checked).toBe(false);
  expect(dialog.textContent).toContain('dejan de computarse como ingresos en Caja');
  await act(async () => waived.click());
  await act(async () => dialog.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(updateRegistrationStatus).toHaveBeenCalledWith(10, expect.objectContaining({ status: 'RECEIVED', feeWaived: true }));
});
