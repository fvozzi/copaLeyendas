import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminRegistrationsPage } from './AdminRegistrationsPage';
import { getAccessGrants, getCategories, getLocalities, getRegistrations } from '../lib/api';
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
  provinceName: 'Buenos Aires',
  clubName: '',
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

const grants = [
  { ...grantDefaults, id: 1, token: 'PENDIENTE', localityName: 'Equipo pendiente', status: 'ACTIVE', consumedAt: null },
  { ...grantDefaults, id: 2, token: 'USADO', localityName: 'Equipo usado', status: 'ACTIVE', consumedAt: '2026-09-10T12:00:00.000Z' },
  { ...grantDefaults, id: 3, token: 'REVOCADO', localityName: 'Equipo revocado', status: 'REVOKED', consumedAt: null },
] as RegistrationAccessGrant[];

const registrations = [{
  id: 10,
  playerOneName: 'Ana Uno',
  playerTwoName: 'Berta Dos',
  localityName: 'Equipo recibido',
  provinceName: 'Córdoba',
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
