import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminCourtsPage } from './AdminCourtsPage';
import { createVenue, deleteVenue, getUsers, getVenues, updateVenue, updateVenueLeaders } from '../lib/api';
import type { Venue } from '../types';

vi.mock('../lib/api', () => ({
  createVenue: vi.fn(), deleteVenue: vi.fn(), getUsers: vi.fn(), getVenues: vi.fn(), updateVenue: vi.fn(), updateVenueLeaders: vi.fn(),
}));

let root: Root;
let container: HTMLDivElement;
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.resetAllMocks(); });

it('edits the leaders responsible for a venue', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const venue = { id: 3, name: 'Gure Echea', address: null, city: 'CABA', provinceName: 'Buenos Aires', startsAt: '10:00', matchDurationMinutes: 40, matchesPerDay: 16, active: true, leaderIds: [8], leaders: [{ id: 8, name: 'Ana', email: 'ana@example.com' }] } as Venue;
  vi.mocked(getVenues).mockResolvedValue([venue]);
  vi.mocked(getUsers).mockResolvedValue([{ id: 8, name: 'Ana', email: 'ana@example.com', role: 'COURT_LEADER', active: true } as never]);
  vi.mocked(updateVenue).mockResolvedValue(venue);
  vi.mocked(updateVenueLeaders).mockResolvedValue(venue);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(AdminCourtsPage)));

  const edit = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Editar')!;
  await act(async () => edit.click());
  const checkbox = document.querySelector<HTMLInputElement>('fieldset input[type="checkbox"]')!;
  expect(checkbox.checked).toBe(true);
  await act(async () => checkbox.click());
  const form = document.querySelector('form')!;
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

  expect(updateVenue).toHaveBeenCalledWith(3, expect.objectContaining({ name: 'Gure Echea' }));
  expect(updateVenueLeaders).toHaveBeenCalledWith(3, []);
  expect(createVenue).not.toHaveBeenCalled();
  expect(deleteVenue).not.toHaveBeenCalled();
});
