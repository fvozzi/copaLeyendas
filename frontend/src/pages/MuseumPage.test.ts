import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { MuseumPage } from './MuseumPage';

let root: Root;
let container: HTMLDivElement;

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
});

it('shows the Museo Pelotari introduction and its three official channels', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(MuseumPage)));

  expect(container.textContent).toContain('Pasión por la Paleta');
  const links = [...container.querySelectorAll<HTMLAnchorElement>('.museum-link-card')];
  expect(links.map((link) => link.href)).toEqual([
    'https://pasionporlapaleta.com.ar/',
    'https://www.instagram.com/museopelotari/',
    'https://www.youtube.com/@museopelotari',
  ]);
  expect(links.every((link) => link.target === '_blank')).toBe(true);
});
