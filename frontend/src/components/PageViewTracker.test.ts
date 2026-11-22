import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { recordPageView } from '../lib/api';
import { PageViewTracker } from './PageViewTracker';

vi.mock('../lib/api', () => ({ recordPageView: vi.fn().mockResolvedValue(undefined) }));

let root: Root;
let container: HTMLDivElement;

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  window.localStorage.clear();
  vi.clearAllMocks();
});

it('tracks a public SPA route with a stable anonymous visitor id', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ['/secciones/historias'], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(PageViewTracker))));

  expect(recordPageView).toHaveBeenCalledWith(expect.objectContaining({ path: '/secciones/historias', visitorId: expect.stringMatching(/^[0-9a-f-]{36}$/) }));
  expect(window.localStorage.getItem('copa_leyendas_analytics_visitor')).toBeTruthy();
});
