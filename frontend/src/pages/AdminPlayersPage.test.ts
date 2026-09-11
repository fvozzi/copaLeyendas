import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminPlayersPage } from './AdminPlayersPage';
import { getLocalities, getPlayerPhoto, getPlayers } from '../lib/api';
vi.mock('../lib/api', () => ({ getLocalities: vi.fn(), getPlayerPhoto: vi.fn(), getPlayers: vi.fn(), createPlayer: vi.fn(), deletePlayer: vi.fn(), downloadPlayersExport: vi.fn(), updatePlayer: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:photo'); static revokeObjectURL = vi.fn(); });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  vi.mocked(getPlayers).mockResolvedValue([{ id: 1, fullName: 'Player One', hasPhoto: true }, { id: 2, fullName: 'Player Two', hasPhoto: false }] as never);
  vi.mocked(getLocalities).mockResolvedValue([]);
  vi.mocked(getPlayerPhoto).mockResolvedValue(new Blob(['photo'], { type: 'image/webp' }));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('opens a saved photo and offers a download only for players with a photo', async () => {
  await act(async () => root.render(createElement(AdminPlayersPage)));
  const view = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === 'Ver foto');
  expect(view).toHaveLength(1);
  expect(container.textContent).toContain('Sin foto');
  await act(async () => view[0].click());
  expect(getPlayerPhoto).toHaveBeenCalledWith(1);
  expect(document.querySelector('img[alt="Foto de Player One"]')?.getAttribute('src')).toBe('blob:photo');
});
it('downloads the authenticated photo with the player name and image extension', async () => {
  const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('Player One.webp');
    expect(this.href).toBe('blob:photo');
  });
  await act(async () => root.render(createElement(AdminPlayersPage)));
  const download = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Descargar')!;
  await act(async () => download.click());
  expect(getPlayerPhoto).toHaveBeenCalledWith(1);
  expect(clicked).toHaveBeenCalledOnce();
});
