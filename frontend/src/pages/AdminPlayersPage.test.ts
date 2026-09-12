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

it('shows the brand, birth date and Instagram, distinguishing no agreement from missing data', async () => {
  vi.mocked(getPlayers).mockResolvedValue([
    { id: 1, fullName: 'Player One', birthDate: '1980-04-03', instagram: '@jugadora', hasCommercialAgreement: true, commercialAgreementDetails: 'Dabber' },
    { id: 2, fullName: 'Player Two', hasCommercialAgreement: false },
    { id: 3, fullName: 'Player Three', hasCommercialAgreement: null },
  ] as never);
  await act(async () => root.render(createElement(AdminPlayersPage)));
  const rows = container.querySelectorAll('tbody tr');
  expect(rows[0].querySelector('[data-label="Marca / acuerdo"]')?.textContent).toBe('Dabber');
  expect(rows[0].querySelector('[data-label="Nacimiento"]')?.textContent).toBe('03/04/1980');
  expect(rows[0].querySelector('[data-label="Instagram"]')?.textContent).toBe('@jugadora');
  expect(rows[1].querySelector('[data-label="Marca / acuerdo"]')?.textContent).toBe('Sin acuerdo');
  expect(rows[2].querySelector('[data-label="Marca / acuerdo"]')?.textContent).toBe('Sin datos');
});
