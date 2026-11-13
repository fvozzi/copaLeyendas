import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminDashboardPage } from './AdminDashboardPage';
import { getDashboardSummary } from '../lib/api';

vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: { role: 'DIRECTOR' } }) }));
vi.mock('../lib/api', () => ({ getDashboardSummary: vi.fn(), downloadShirtProjection: vi.fn() }));
let root: Root;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });

it('includes unused tokens in category totals and applies capacity only to confirmed pairs', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getDashboardSummary).mockResolvedValue({
    players: { total: 40, withCuil: 17 },
    posts: { total: 0, published: 0, featured: 0, bySection: {} },
    registrations: { total: 20, byCategory: { 'Damas A': 4, 'Damas B': 16, 'Damas C': 0 }, confirmedByCategory: { 'Damas A': 1, 'Damas B': 16, 'Damas C': 0 }, byCategoryAndStatus: {
      'Damas A': { RECEIVED: 1, UNDER_REVIEW: 1, CONFIRMED: 1, WAITLIST: 0, REJECTED: 1 },
      'Damas B': { RECEIVED: 0, UNDER_REVIEW: 0, CONFIRMED: 16, WAITLIST: 0, REJECTED: 0 },
      'Damas C': { RECEIVED: 0, UNDER_REVIEW: 0, CONFIRMED: 0, WAITLIST: 0, REJECTED: 0 },
    }, byStatus: {}, shirtSizes: { M: 8 },
      shirtDistribution: { sizes: ['S', 'M'], totals: { M: 8 }, total: 8, models: ['Guastavino Color 1', 'Guastavino Color 2', 'Dabber Color 3', 'Dabber Color 4'].map(name => ({ name, sizes: { S: 0, M: 2 }, total: 2 })) } },
    accessGrants: { total: 33, byCategory: { 'Damas A': 16, 'Damas B': 17, 'Damas C': 0 }, byStatus: {} },
    matchesByVenue: { tournamentName: null, venues: [], totalMatches: 0 },
  });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(AdminDashboardPage))));
  const rows = container.querySelectorAll('.category-summary-table tbody tr');
  const playerCard = [...container.querySelectorAll('.stat-card')].find((card) => card.textContent?.includes('Jugadoras'))!;
  expect(playerCard.textContent).toContain('40');
  expect(playerCard.textContent).toContain('17');
  expect(playerCard.textContent).toContain('Con CUIL');
  expect(playerCard.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('17');
  expect(rows).toHaveLength(3);
  expect(Array.from(rows[0].querySelectorAll('strong')).map((cell) => cell.textContent)).toEqual(['16', '1', '1', '1', '0', '1']);
  expect(rows[0].textContent).not.toContain('Cupo completo');
  expect(rows[1].textContent).toContain('Cupo completo');
  expect(Array.from(rows[1].querySelectorAll('strong')).map((cell) => cell.textContent)).toEqual(['17', '0', '0', '16', '0', '0']);
  expect(Array.from(rows[2].querySelectorAll('strong')).map((cell) => cell.textContent)).toEqual(['0', '0', '0', '0', '0', '0']);
  const shirts = container.querySelector('.shirt-distribution-table')!;
  expect(shirts.querySelectorAll('tbody tr')).toHaveLength(4);
  expect(shirts.querySelector('tbody th')?.textContent).toBe('Guastavino Color 1');
  expect(shirts.querySelector('tfoot .shirt-model-total')?.textContent).toBe('8');
  const cards = [...container.querySelectorAll('.admin-grid > section')].map(section => section.querySelector('h2')?.textContent);
  expect(cards.slice(-4)).toEqual(['Camisetas por modelo y talle', 'Estado de seguimiento', 'Estado de tokens', 'Publicaciones por seccion']);
});
