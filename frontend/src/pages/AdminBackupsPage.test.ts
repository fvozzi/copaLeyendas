import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminBackupsPage } from './AdminBackupsPage';
import { createBackup, downloadBackup, getBackups } from '../lib/api';
import type { BackupOverview } from '../types';

const auth = vi.hoisted(() => ({ user: { role: 'DIRECTOR' } }));
vi.mock('../lib/auth', () => ({ useAuth: () => auth }));
vi.mock('../lib/api', () => ({ createBackup: vi.fn(), downloadBackup: vi.fn(), getBackups: vi.fn(), updateBackupSettings: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
let overview: BackupOverview;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers(); auth.user.role = 'DIRECTOR';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  overview = { enabled: true, retentionCount: 30, scheduleHour: 3, scheduleMinute: 0, timezone: 'America/Argentina/Buenos_Aires', backups: [] };
  vi.mocked(getBackups).mockImplementation(async () => ({ ...overview, backups: [...overview.backups] }));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); vi.useRealTimers(); });
async function render() {
  await act(async () => root.render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(AdminBackupsPage))));
}
it('starts a backup, follows its progress, then enables the authenticated download', async () => {
  vi.mocked(createBackup).mockImplementationOnce(async () => {
    overview.backups = [{ id: 1, status: 'RUNNING', triggerType: 'MANUAL', createdByName: 'Director', startedAt: '2026-09-11T12:00:00Z', finishedAt: null, fileName: null, fileSizeBytes: null, errorMessage: null, canDownload: false }];
    return { id: 1, status: 'RUNNING' };
  });
  await render();
  const create = container.querySelector('.panel-header button') as HTMLButtonElement;
  await act(async () => create.click());
  expect(createBackup).toHaveBeenCalledOnce();
  expect(create.disabled).toBe(true);
  expect(container.textContent).toContain('En curso');
  let download = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Descargar')!;
  expect(download.disabled).toBe(true);
  overview.backups[0] = { ...overview.backups[0], status: 'SUCCESS', canDownload: true, fileName: 'copa.dump', fileSizeBytes: 1024 };
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  download = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Descargar')!;
  expect(download.disabled).toBe(false);
  await act(async () => download.click());
  expect(downloadBackup).toHaveBeenCalledWith(expect.objectContaining({ id: 1, fileName: 'copa.dump' }));
});
it('shows a failed backup without allowing download', async () => {
  overview.backups = [{ id: 1, status: 'FAILED', triggerType: 'SCHEDULED', startedAt: '2026-09-11T06:00:00Z', finishedAt: null, createdByName: null, fileName: null, fileSizeBytes: null, errorMessage: 'No se encontro pg_dump', canDownload: false }];
  await render();
  expect(container.textContent).toContain('No se encontro pg_dump');
  const download = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Descargar')!;
  expect(download.disabled).toBe(true);
});
it('does not request backups for assistants', async () => {
  auth.user.role = 'ASSISTANT';
  await render();
  expect(getBackups).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain('Crear backup ahora');
});
