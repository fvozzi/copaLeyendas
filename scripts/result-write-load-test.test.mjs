import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));

test('starts and finishes several local matches concurrently', { timeout: 15_000 }, async () => {
  const statuses = new Map([[101, 'READY'], [102, 'READY'], [103, 'READY']]);
  let starts = 0;
  let results = 0;
  const server = createServer((request, response) => {
    const finish = () => {
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('X-Request-Id', `test-${starts}-${results}`);
      if (request.url === '/api/health') return response.end('{"status":"ok"}');
      if (request.url === '/api/tournaments/operations') {
        const slots = [...statuses].map(([matchId, status], index) => ({
          id: index + 1, matchId, sequence: index + 1, zoneName: 'Zona A',
          tournamentCategory: { pointsPerSet: 25, category: { name: 'Damas B' } },
          match: { id: matchId, status, homeScore: status === 'PLAYED' ? 25 : null, awayScore: status === 'PLAYED' ? 10 : null, homeRegistration: { id: 1 }, awayRegistration: { id: 2 } },
        }));
        return response.end(JSON.stringify({ slots }));
      }
      const start = request.url?.match(/^\/api\/tournaments\/matches\/(\d+)\/start$/);
      if (start) { starts += 1; statuses.set(Number(start[1]), 'IN_PROGRESS'); return response.end('{}'); }
      const result = request.url?.match(/^\/api\/tournaments\/matches\/(\d+)\/result$/);
      if (result) { results += 1; statuses.set(Number(result[1]), 'PLAYED'); return response.end('{}'); }
      response.statusCode = 404;
      return response.end('{"message":"not found"}');
    };
    if (request.method === 'POST') { request.resume(); request.on('end', finish); }
    else finish();
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  assert(address && typeof address === 'object');
  try {
    const run = await childProcess(process.execPath, [
      join(scriptsDirectory, 'result-write-load-test.mjs'), '--api-url', `http://127.0.0.1:${address.port}/api`,
      '--count', '3', '--token', 'test-token', '--confirm-local-writes',
    ]);
    assert.equal(run.code, 0, run.stderr || run.stdout);
    assert.equal(starts, 3);
    assert.equal(results, 3);
    assert.match(run.stdout, /RESULTADO: APROBADO/);
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
