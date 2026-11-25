import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { createPublicCourt, searchCommunityCourtLocation } from '../lib/api';
import { CourtSubmissionPage } from './CourtSubmissionPage';

vi.mock('../components/CourtMap', () => ({ CourtMap: ({ onPositionChange }: { onPositionChange: (position: { latitude: number; longitude: number }) => void }) => createElement('button', { type: 'button', id: 'choose-location', onClick: () => onPositionChange({ latitude: -34.6, longitude: -58.4 }) }, 'Elegir punto') }));
vi.mock('../lib/api', () => ({ createPublicCourt: vi.fn(), searchCommunityCourtLocation: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.resetAllMocks(); });

it('submits the exact map point and a configurable player group', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), configurable: true });
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:court-photo'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  vi.mocked(createPublicCourt).mockImplementation(async (payload) => ({ id: 1, totalPlayers: 30, createdAt: '', ...payload, playerGroups: payload.playerGroups, photos: [] }));
  vi.mocked(searchCommunityCourtLocation).mockResolvedValue({ latitude: -34.61, longitude: -58.42, displayName: 'Morón, Buenos Aires, Argentina' });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(CourtSubmissionPage))));

  setLabelValue('Nombre de la cancha', 'Club Central');
  setLabelValue('Provincia / departamento / estado', 'Buenos Aires');
  setLabelValue('Localidad', 'Morón');
  const searchButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Buscar localidad') as HTMLButtonElement;
  await act(async () => searchButton.click());
  expect(searchCommunityCourtLocation).toHaveBeenCalledWith({ query: 'Morón, Buenos Aires, Argentina', countryCode: 'ar' });
  setLabelValue('Frontón', 'MARBLE');
  setLabelValue('Color', 'BLUE');
  setLabelValue('Historia de la cancha', 'Construida por vecinos en 1950.');
  setLabelValue('Fecha de inauguración', '1950-05-10');
  setLabelValue('Nombre o institución', 'Secretaría del club');
  setLabelValue('Teléfono / WhatsApp', '+54 9 11 1234-5678');
  setLabelValue('Correo electrónico', 'club@example.com');
  setLabelValue('Web o red social', 'https://example.com');
  await clickLabelCheckbox('Cuenta con escuelita');
  const photo = new File(['foto'], 'cancha.jpg', { type: 'image/jpeg' });
  const photoInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(photoInput, 'files', { value: [photo], configurable: true });
  await act(async () => { photoInput.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(container.textContent).toContain('cancha.jpg');
  expect(container.textContent).toContain('Material del share');
  setLabelValue('Tipo de cancha', 'FRONTON');
  expect(container.textContent).not.toContain('Material del share');
  expect(container.textContent).toContain('Orientación de las paredes');
  setLabelValue('Material del rebote', 'Material');
  await clickLabelCheckbox('Tiene cacerola');
  setInputValueByAria('Mujeres, entre 0 y 20', '30');
  await act(async () => { (container.querySelector('#choose-location') as HTMLButtonElement).click(); });
  await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

  expect(createPublicCourt).toHaveBeenCalledWith(expect.objectContaining({ name: 'Club Central', locality: 'Morón', latitude: -34.6, longitude: -58.4, frontisFinish: 'MARBLE', courtColor: 'BLUE', history: 'Construida por vecinos en 1950.', inaugurationDate: '1950-05-10', contactName: 'Secretaría del club', contactPhone: '+54 9 11 1234-5678', contactEmail: 'club@example.com', contactUrl: 'https://example.com', hasSchool: true, courtType: 'FRONTON', frontonWallOrientation: 'LEFT_LONG', frontonHasCacerola: true, frontonBackType: 'REBOUND', frontonReboundMaterial: 'Material', playerGroups: [{ gender: 'FEMALE', minAge: 0, maxAge: 20, playerCount: 30 }] }), [photo]);

  function setInputValueByAria(label: string, value: string) {
    const control = container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(control, value);
      control.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function clickLabelCheckbox(labelText: string) {
    const label = [...container.querySelectorAll('label')].find((candidate) => candidate.textContent?.startsWith(labelText));
    await act(async () => { (label?.querySelector('input') as HTMLInputElement).click(); });
  }

  function setLabelValue(labelText: string, value: string) {
    const label = [...container.querySelectorAll('label')].find((candidate) => candidate.textContent?.startsWith(labelText));
    const control = label?.querySelector('input,select,textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    act(() => {
      const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(control, value);
      control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    });
  }
});
