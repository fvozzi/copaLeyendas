import { ConfigService } from '@nestjs/config';
import { mkdir, mkdtemp, readdir, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupsService, scheduledTime } from './backups.service';
import { runPgDump } from './pg-dump';

vi.mock('./pg-dump', () => ({ runPgDump: vi.fn() }));
let directory: string;
let service: BackupsService;

function setup(enabled = true) {
  const settingsValue = { id: 1, enabled, retentionCount: 2, scheduleHour: 3, scheduleMinute: 0 };
  const rows: any[] = [];
  const settings = {
    createQueryBuilder: () => ({ insert: () => ({ values: () => ({ orIgnore: () => ({ execute: async () => ({}) }) }) }) }),
    findOneByOrFail: vi.fn(async () => settingsValue), update: vi.fn(async (_id, value) => Object.assign(settingsValue, value)),
  };
  const backups = {
    create: (value: any) => value,
    save: vi.fn(async (value) => { const row = { ...value, id: Math.max(0, ...rows.map((row) => row.id)) + 1 }; rows.push(row); return row; }),
    update: vi.fn(async (id, value) => { rows.filter((row) => typeof id === 'number' ? row.id === id : row.status === id.status).forEach((row) => Object.assign(row, value)); }),
    find: vi.fn(async (options) => [...rows].filter((row) => !options.where || row.status === options.where.status).sort((a, b) => b.id - a.id)),
    findOneBy: vi.fn(async ({ id }) => rows.find((row) => row.id === id)),
    countBy: vi.fn(async () => rows.filter((row) => row.triggerType === 'SCHEDULED').length),
    delete: vi.fn(async (id) => { rows.splice(rows.findIndex((row) => row.id === id), 1); }),
  };
  const runner = { connect: vi.fn(), release: vi.fn(), query: vi.fn(async (_sql: string, _params?: unknown[]) => [{ locked: true }]) };
  service = new BackupsService(settings as never, backups as never, { createQueryRunner: () => runner } as never, new ConfigService({
    BACKUP_STORAGE_DIR: directory, DB_HOST: 'localhost', DB_USER: 'test-user', DB_PASSWORD: 'private-password', DB_NAME: 'test-database',
  }));
  return { rows, runner, backups, settingsValue };
}

async function finished() { await (service as unknown as { job: Promise<void> }).job; }
beforeEach(async () => {
  const parent = resolve('storage'); await mkdir(parent, { recursive: true });
  directory = await mkdtemp(join(parent, 'backup-test-'));
  vi.mocked(runPgDump).mockImplementation(async ({ outputPath }) => { await writeFile(outputPath, 'PGDMP-test-backup'); });
});
afterEach(async () => {
  await service?.onModuleDestroy();
  // Only remove files in this test's freshly created, known directory.
  if (!directory.startsWith(join(resolve('storage'), 'backup-test-'))) throw new Error('Unexpected test path');
  for (const file of await readdir(directory)) await unlink(join(directory, file));
  await rmdir(directory);
  vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers();
});

describe('database backups', () => {
  it('runs in the background, publishes a completed file and releases the dedicated lock', async () => {
    const { rows, runner } = setup();
    expect(await service.start('MANUAL', 'Director')).toEqual({ id: 1, status: 'RUNNING' });
    await finished();
    expect(rows[0]).toMatchObject({ status: 'SUCCESS', createdByName: 'Director', fileSizeBytes: '17' });
    expect(await readFile(join(directory, rows[0].fileName), 'utf8')).toBe('PGDMP-test-backup');
    expect((await service.overview()).backups[0].canDownload).toBe(true);
    const download = await service.download(1);
    download.stream.getStream().destroy();
    expect(download.fileName).toBe(rows[0].fileName);
    expect(runner.query.mock.calls.map((args) => args[0])).toEqual(['SELECT pg_try_advisory_lock($1) AS locked', 'SELECT pg_advisory_unlock($1)']);
    expect(runner.release).toHaveBeenCalledOnce();
  });
  it('rejects overlapping requests while pg_dump is running', async () => {
    setup();
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(runPgDump).mockImplementationOnce(async ({ outputPath }) => { await wait; await writeFile(outputPath, 'PGDMP-test-backup'); });
    await service.start('MANUAL', null);
    await expect(service.start('MANUAL', null)).rejects.toThrow('en curso');
    release(); await finished();
  });
  it('honors a lock held by another server worker and releases its own connection', async () => {
    const { runner, rows } = setup();
    runner.query.mockResolvedValueOnce([{ locked: false }]);
    await expect(service.start('MANUAL', null)).rejects.toThrow('en curso');
    expect(rows).toHaveLength(0);
    expect(runner.release).toHaveBeenCalledOnce();
    expect(runner.query).toHaveBeenCalledOnce();
  });
  it('records errors without passwords, removes partial files and never offers a failed download', async () => {
    const { rows } = setup();
    vi.mocked(runPgDump).mockRejectedValueOnce(new Error('private-password failed'));
    await service.start('MANUAL', null); await finished();
    expect(rows[0]).toMatchObject({ status: 'FAILED', errorMessage: '[oculto] failed' });
    expect(await readdir(directory)).toEqual([]);
    await expect(service.download(1)).rejects.toThrow('no esta disponible');
    await service.start('MANUAL', null); await finished();
    expect(rows[1].status).toBe('SUCCESS');
  });
  it('prunes completed copies only after a new success and preserves them on failure', async () => {
    const { rows } = setup();
    for (let i = 0; i < 3; i++) { await service.start('MANUAL', null); await finished(); }
    expect(rows).toHaveLength(2);
    expect(await readdir(directory)).toHaveLength(2);
    vi.mocked(runPgDump).mockRejectedValueOnce(new Error('dump failed'));
    await service.start('MANUAL', null); await finished();
    expect(rows.filter((row) => row.status === 'SUCCESS')).toHaveLength(2);
    expect(await readdir(directory)).toHaveLength(2);
  });
  it('uses the Argentine day and executes the scheduled job once even after restart', async () => {
    const { rows } = setup();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-11T05:59:00Z'));
    expect(await service.start('SCHEDULED', null)).toBeNull();
    vi.setSystemTime(new Date('2026-09-11T06:00:00Z'));
    await service.start('SCHEDULED', null); await finished();
    expect(await service.start('SCHEDULED', null)).toBeNull();
    expect(rows).toHaveLength(1);
    expect(scheduledTime(new Date('2026-09-11T01:00:00Z'), 3, 0).toISOString()).toBe('2026-09-10T06:00:00.000Z');
  });
  it('supports pausing the schedule without disabling manual backups and rejects unsafe filenames', async () => {
    const { rows } = setup(false);
    expect(await service.start('SCHEDULED', null)).toBeNull();
    await service.start('MANUAL', null); await finished();
    rows[0].fileName = '../.env';
    await expect(service.download(1)).rejects.toThrow('no esta disponible');
  });
  it('recovers interrupted records and rejects invalid dump output', async () => {
    const { rows } = setup();
    rows.push({ id: 1, status: 'RUNNING' });
    vi.mocked(runPgDump).mockImplementationOnce(async ({ outputPath }) => { await writeFile(outputPath, 'not a dump'); });
    await service.start('MANUAL', null); await finished();
    expect(rows[0]).toMatchObject({ status: 'FAILED', errorMessage: expect.stringContaining('interrumpio') });
    expect(rows[1]).toMatchObject({ status: 'FAILED', errorMessage: expect.stringContaining('valido') });
  });
});
