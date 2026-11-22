import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { getAnalyticsSummary } from '../lib/api';
import { AdminAnalyticsPage } from './AdminAnalyticsPage';

vi.mock('../lib/api', () => ({ getAnalyticsSummary: vi.fn() }));

let root: Root;
let container: HTMLDivElement;

afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.resetAllMocks(); });

it('shows visits, visitors and the most used public sections', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getAnalyticsSummary).mockResolvedValue({
    days: 30, from: '2026-10-23T00:00:00.000Z', views: 120, visitors: 45,
    sections: [{ label: 'Historias', views: 60, visitors: 30 }],
    pages: [{ label: '/secciones/historias', views: 60, visitors: 30 }],
    devices: [{ label: 'MOBILE', views: 80 }], referrers: [{ label: 'Directo', views: 70 }],
    daily: [{ date: '2026-11-22', views: 20, visitors: 10 }],
  });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(AdminAnalyticsPage)));

  expect(container.textContent).toContain('120');
  expect(container.textContent).toContain('45');
  expect(container.textContent).toContain('Historias');
  expect(container.textContent).toContain('Celular');
});
