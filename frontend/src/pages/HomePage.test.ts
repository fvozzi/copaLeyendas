import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { getPublicPosts } from '../lib/api';
import { HomePage } from './HomePage';

vi.mock('../lib/api', () => ({ getPublicPosts: vi.fn() }));

let root: Root;
let container: HTMLDivElement;

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  vi.resetAllMocks();
});

it('links the home hero to the current tournament edition', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getPublicPosts).mockResolvedValue([]);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(HomePage))));

  const link = [...container.querySelectorAll('a')].find((item) => item.textContent?.trim() === 'Ver torneo');
  expect(link?.getAttribute('href')).toBe('/torneos/femme-2026');
  expect(container.querySelector('a[href="/secciones/leyendas"]')).toBeNull();
  expect(container.querySelector('a[href="/secciones/canchas"]')).toBeNull();
  expect(container.querySelectorAll('.section-grid .section-card')).toHaveLength(2);
});
