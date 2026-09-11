import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminDashboardPage } from './AdminDashboardPage';
import { getDashboardSummary } from '../lib/api';

vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: { role: 'DIRECTOR' } }) }));
vi.mock('../lib/api', () => ({ getDashboardSummary: vi.fn() }));
let root: Root;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });

it('compares issued grants with confirmed pairs and distinguishes the 16-pair limit from overflow', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getDashboardSummary).mockResolvedValue({
    posts: { total: 0, published: 0, featured: 0, bySection: {} },
    registrations: { total: 20, byCategory: { 'Damas A': 4, 'Damas B': 16, 'Damas C': 0 }, confirmedByCategory: { 'Damas A': 1, 'Damas B': 16, 'Damas C': 0 }, byStatus: {}, shirtSizes: {} },
    accessGrants: { total: 33, byCategory: { 'Damas A': 16, 'Damas B': 17, 'Damas C': 0 }, byStatus: {} },
    matchesByVenue: { tournamentName: null, venues: [], totalMatches: 0 },
  });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(AdminDashboardPage))));
  const rows = container.querySelectorAll('.category-summary-table tbody tr');
  expect(rows).toHaveLength(3);
  expect(Array.from(rows[0].querySelectorAll('strong')).map((cell) => cell.textContent)).toEqual(['16', '1']);
  expect(rows[0].textContent).toContain('Cupo completo');
  expect(rows[1].textContent).toContain('Excede por 1');
  expect(Array.from(rows[2].querySelectorAll('strong')).map((cell) => cell.textContent)).toEqual(['0', '0']);
});
