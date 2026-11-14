import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));

test('runs staged users and a concurrent burst against the configured API', { timeout: 15_000 }, async () => {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/health') response.end(JSON.stringify({ status: 'ok' }));
    else if (request.url?.startsWith('/api/public/tournaments/current')) response.end(JSON.stringify({ tournament: null, courts: [] }));
    else if (request.url?.startsWith('/api/public/posts')) response.end('[]');
    else response.end('{}');
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  assert(address && typeof address === 'object');

  try {
    const result = await childProcess(process.execPath, [
      join(scriptsDirectory, 'tournament-load-test.mjs'),
      '--api-url', `http://127.0.0.1:${address.port}/api`,
      '--users', '3', '--duration', '1', '--ramp', '0',
      '--poll-ms', '100', '--burst-rounds', '1', '--max-p95-ms', '5000', '--max-p99-ms', '5000',
    ]);
    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Ráfaga 1\/1 completada/);
    assert.match(result.stdout, /RESULTADO: APROBADO/);
    assert.match(result.stdout, /público: torneo actual \(ráfaga\)/);
  } finally {
    await new Promise((done) => server.close(done));
  }
});

function childProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: join(scriptsDirectory, '..'), windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}
