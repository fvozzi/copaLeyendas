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
    registrations: { total: 20, byCategory: { 'Damas A': 4, 'Damas B': 16, 'Damas C': 0 }, confirmedByCategory: { 'Damas A': 1, 'Damas B': 16, 'Damas C': 0 }, byStatus: {}, shirtSizes: { M: 8 },
      shirtDistribution: { sizes: ['S', 'M'], totals: { M: 8 }, total: 8, models: ['Guastavino Color 1', 'Guastavino Color 2', 'Dabber Color 3', 'Dabber Color 4'].map(name => ({ name, sizes: { S: 0, M: 2 }, total: 2 })) } },
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
  const shirts = container.querySelector('.shirt-distribution-table')!;
  expect(shirts.querySelectorAll('tbody tr')).toHaveLength(4);
  expect(shirts.querySelector('tbody th')?.textContent).toBe('Guastavino Color 1');
  expect(shirts.querySelector('tfoot .shirt-model-total')?.textContent).toBe('8');
  const cards = [...container.querySelectorAll('.admin-grid > section')].map(section => section.querySelector('h2')?.textContent);
  expect(cards.slice(-4)).toEqual(['Camisetas por modelo y talle', 'Estado de seguimiento', 'Estado de tokens', 'Publicaciones por seccion']);
});
