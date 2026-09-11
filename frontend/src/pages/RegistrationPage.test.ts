import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicRegistrationAccess } from '../lib/api';
import type { PublicAccessGrant } from '../types';
import { RegistrationPage } from './RegistrationPage';

vi.mock('../lib/api', () => ({ getPublicRegistrationAccess: vi.fn(), createPublicRegistration: vi.fn() }));

const grant = {
  enabled: true, token: 'COPA-TEST', localityName: 'Junin', provinceName: 'Buenos Aires',
  category: { name: 'Damas A' }, feeWaived: true,
} as PublicAccessGrant;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getPublicRegistrationAccess).mockResolvedValue(grant);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function renderPage(path = '/inscripcion?token=COPA-TEST') {
  await act(async () => root.render(createElement(MemoryRouter, {
    initialEntries: [path], future: { v7_startTransition: true, v7_relativeSplatPath: true },
  }, createElement(RegistrationPage))));
}

describe('registration form', () => {
  it('hides token validation after opening a valid link and allows changing it', async () => {
    await renderPage();
    expect(getPublicRegistrationAccess).toHaveBeenCalledWith('COPA-TEST');
    expect(container.querySelector('.token-card')).toBeNull();
    expect(container.querySelector('.grant-card')?.textContent).toContain('Junin');
    await act(async () => (container.querySelector('.grant-card button') as HTMLButtonElement).click());
    expect(container.querySelector('.token-card')?.textContent).toContain('Validar token');
    expect(container.querySelector('.registration-form')).toBeNull();
  });

  it('keeps manual validation available when the link is rejected', async () => {
    vi.mocked(getPublicRegistrationAccess).mockRejectedValueOnce(new Error('Token revocado'));
    await renderPage();
    expect(container.querySelector('.token-card button')?.textContent).toBe('Validar token');
    expect(container.querySelector('.form-error')?.textContent).toBe('Token revocado');
    expect(container.querySelector('.registration-form')).toBeNull();
  });

  it('offers three brands per player, permits one or none and keeps players independent', async () => {
    await renderPage();
    const groups = container.querySelectorAll('.player-agreement-options');
    expect(groups).toHaveLength(3);
    for (const group of groups) expect(group.querySelectorAll('input')).toHaveLength(3);
    const first = Array.from(groups[0].querySelectorAll('input'));
    const second = groups[1].querySelector('input')!;
    expect(first.every((input) => !input.checked)).toBe(true);
    await act(async () => first[0].click());
    await act(async () => second.click());
    await act(async () => first[1].click());
    expect(first.map((input) => input.checked)).toEqual([false, true, false]);
    expect(second.checked).toBe(true);
    await act(async () => first[1].click());
    expect(first.every((input) => !input.checked)).toBe(true);
    expect(second.checked).toBe(true);
  });

  it.each([
    ['desktop', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', false],
    ['Android', 'Mozilla/5.0 (Linux; Android 14) Mobile', true],
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true],
  ])('offers the correct photo pickers on %s', async (_device, userAgent, camera) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    await renderPage();
    const photo = container.querySelector('.player-photo-field')!;
    const inputs = photo.querySelectorAll<HTMLInputElement>('input[type=file]');
    expect(inputs).toHaveLength(camera ? 2 : 1);
    expect(inputs[0].hasAttribute('capture')).toBe(false);
    const picker = vi.spyOn(inputs[0], 'click').mockImplementation(() => {});
    await act(async () => photo.querySelector('button')!.click());
    expect(picker).toHaveBeenCalledOnce();
    if (camera) {
      expect(inputs[1].getAttribute('capture')).toBe('environment');
      const capture = vi.spyOn(inputs[1], 'click').mockImplementation(() => {});
      await act(async () => photo.querySelectorAll('button')[1].click());
      expect(capture).toHaveBeenCalledOnce();
    }
  });
});
