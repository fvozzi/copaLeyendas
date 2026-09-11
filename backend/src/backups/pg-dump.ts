import { spawn } from 'node:child_process';

export interface DumpOptions {
  binary: string; host: string; port: string; username: string; password: string;
  database: string; outputPath: string; signal: AbortSignal;
}

export function runPgDump(options: DumpOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.binary, [
      '--host', options.host, '--port', options.port, '--username', options.username,
      '--dbname', options.database, '--format=custom', '--no-owner', '--no-privileges',
      '--no-password', '--file', options.outputPath,
    ], {
      shell: false, windowsHide: true, signal: options.signal, timeout: 30 * 60 * 1000,
      killSignal: 'SIGKILL', stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, PGPASSWORD: options.password, PGCONNECT_TIMEOUT: '20' },
    });
    let stderr = '';
    let processError: Error | null = null;
    child.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8000); });
    child.on('error', (error) => { processError = error; });
    // Wait for close, including on abort, before removing the partial file or releasing the lock.
    child.on('close', (code) => {
      if (code === 0 && !processError) resolve();
      else reject(processError ?? new Error(stderr.trim() || `pg_dump finalizo con codigo ${code ?? 'desconocido'}`));
    });
  });
}
