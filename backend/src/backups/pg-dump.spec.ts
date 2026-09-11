import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { runPgDump } from './pg-dump';
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

function childProcess() {
  const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter() });
  vi.mocked(spawn).mockReturnValue(child as never);
  return child;
}
const options = { binary: 'pg_dump', host: 'localhost', port: '5432', username: 'app-user', password: 'secret-password', database: 'copa_leyendas', outputPath: 'backup.dump.partial', signal: new AbortController().signal };

describe('pg_dump process', () => {
  it('passes the password only through the environment and uses custom format without a shell', async () => {
    const child = childProcess();
    const result = runPgDump(options);
    const [binary, args, config] = vi.mocked(spawn).mock.calls.at(-1)!;
    expect(binary).toBe('pg_dump');
    expect(args).toContain('--format=custom');
    expect(args).not.toContain(options.password);
    expect(config).toMatchObject({ shell: false, windowsHide: true, env: { PGPASSWORD: options.password }, timeout: 1800000 });
    child.emit('close', 0);
    await expect(result).resolves.toBeUndefined();
  });
  it('waits for process close after an abort or spawn failure', async () => {
    const child = childProcess();
    const result = runPgDump(options);
    let settled = false;
    void result.catch(() => { settled = true; });
    child.emit('error', new Error('spawn ENOENT'));
    await Promise.resolve();
    expect(settled).toBe(false);
    child.emit('close', -2);
    await expect(result).rejects.toThrow('ENOENT');
  });
});
