import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicRegistration, getPublicRegistrationAccess } from '../lib/api';
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
  it('loads a correction, adds a substitute and submits without uploading the saved files again', async () => {
    vi.mocked(getPublicRegistrationAccess).mockResolvedValue({ ...grant, feeWaived: false, registration: {
      fields: { representingText: 'Junín', heardAboutSource: 'CLUB', contactEmail: 'team@example.com',
        playerOneName: 'Jugadora Uno', playerOneDni: '11111111', playerOneBirthDate: '1980-01-01', playerOnePhone: '1111111111', playerOneShirtSize: 'L', playerOneHasCommercialAgreement: true, playerOneCommercialAgreementDetails: 'Dabber',
        playerTwoName: 'Jugadora Dos', playerTwoDni: '22222222', playerTwoBirthDate: '1981-01-01', playerTwoPhone: '2222222222',
      }, photos: { playerOne: 'uno.jpg', playerTwo: 'dos.jpg', playerThree: null }, paymentProofName: 'pago.pdf',
    } });
    vi.mocked(createPublicRegistration).mockResolvedValue({ id: 42, status: 'CONFIRMED', message: 'Inscripción actualizada con éxito.' });
    await renderPage();
    expect(container.textContent).toContain('Rectificar inscripción');
    expect(container.textContent).toContain('Foto cargada: uno.jpg');
    expect(container.textContent).toContain('Comprobante cargado: pago.pdf');
    const sections = container.querySelectorAll('.player-card');
    const playerSections = sections.length ? sections : Array.from(container.querySelectorAll('.form-section')).filter((section) => section.querySelector('.player-photo-field'));
    const firstInputs = playerSections[0].querySelectorAll('input');
    expect(firstInputs[0].value).toBe('Jugadora Uno');
    expect(playerSections[0].querySelector('select')?.value).toBe('L');
    expect(playerSections[0].querySelectorAll<HTMLInputElement>('.player-agreement-options input')[1].checked).toBe(true);
    const inputs = playerSections[2].querySelectorAll('input');
    for (const [index, value] of ['Suplente Nueva', '33333333', '1982-01-01', '3333333333'].entries()) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(inputs[index], value);
        inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    await act(async () => container.querySelector('.registration-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(createPublicRegistration).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'COPA-TEST', playerOneName: 'Jugadora Uno', playerOneShirtSize: 'L', playerThreeName: 'Suplente Nueva', playerThreeDni: '33333333', paymentProof: undefined, playerOnePhoto: undefined }));
    expect(container.textContent).toContain('Inscripción actualizada con éxito.');
  });

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
