#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const defaults = {
  apiUrl: defaultLocalApiUrl(),
  siteUrl: '',
  users: 30,
  durationSeconds: 60,
  rampSeconds: 10,
  pollMs: 3_000,
  timeoutMs: 5_000,
  burstRounds: 3,
  maxErrorRate: 0.01,
  maxP95Ms: 1_000,
  maxP99Ms: 2_000,
  allowRemote: false,
  output: '',
};

let config;
try {
  config = parseArguments(process.argv.slice(2));
} catch (reason) {
  console.error(`ERROR: ${reason instanceof Error ? reason.message : reason}`);
  process.exit(2);
}
if (config.help) {
  printHelp();
  process.exit(0);
}

let api = '';
let site = '';
const metrics = new Map();
const startedAt = Date.now();
let activeUsers = 0;
let interrupted = false;

process.on('SIGINT', () => {
  interrupted = true;
  process.stdout.write('\nInterrupción solicitada: cerrando usuarios y preparando el resumen...\n');
});

try {
  await run();
} catch (reason) {
  console.error(`\nERROR: ${reason instanceof Error ? reason.message : reason}`);
  process.exitCode = 2;
}

async function run() {
  validateConfig(config);
  api = config.apiUrl.replace(/\/+$/, '');
  site = config.siteUrl.replace(/\/+$/, '');
  console.log('Prueba de concurrencia Copa Leyendas');
  console.log(`API: ${api}`);
  if (site) console.log(`Sitio: ${site}`);
  console.log(`Usuarios virtuales: ${config.users} · rampa: ${config.rampSeconds}s · carga sostenida: ${config.durationSeconds}s · sondeo: ${config.pollMs}ms`);
  console.log(`Ráfagas finales: ${config.burstRounds} × ${config.users} solicitudes simultáneas`);
  console.log('Modo público: solo se ejecutan GET sin autenticación. No se modifican datos deportivos.');
  console.log('Aviso: el servidor registra estas consultas como filas nuevas en Actividad, igual que el tráfico real.');

  await preflight();
  const staticAssets = site ? await discoverStaticAssets() : [];
  const livePhotos = await discoverLivePhotos();
  if (livePhotos.length) console.log(`Fotos públicas en juego detectadas: ${livePhotos.length}. También se incluirán en la prueba.`);
  const progress = setInterval(printProgress, 5_000);
  const steadyEnd = Date.now() + (config.rampSeconds + config.durationSeconds) * 1_000;
  try {
    await Promise.all(Array.from({ length: config.users }, (_, index) => virtualUser(index, steadyEnd, staticAssets, livePhotos)));

    if (!interrupted) {
      console.log('\nIniciando ráfagas simultáneas...');
      for (let round = 1; round <= config.burstRounds && !interrupted; round += 1) {
        await Promise.all(Array.from({ length: config.users }, () => measuredRequest('público: torneo actual (ráfaga)', `${api}/public/tournaments/current`)));
        console.log(`Ráfaga ${round}/${config.burstRounds} completada.`);
        if (round < config.burstRounds) await sleep(1_000);
      }
    }
  } finally {
    clearInterval(progress);
  }

  const report = buildReport();
  printReport(report);
  if (config.output) await saveReport(report, config.output);
  process.exitCode = interrupted ? 130 : report.passed ? 0 : 1;
}

async function virtualUser(index, endAt, assets, livePhotos) {
  const rampDelay = config.rampSeconds ? Math.round((index / Math.max(config.users - 1, 1)) * config.rampSeconds * 1_000) : 0;
  await sleep(rampDelay);
  if (interrupted) return;
  activeUsers += 1;
  try {
    if (site) {
      await measuredRequest('sitio: HTML', `${site}/`);
      for (const asset of assets) await measuredRequest(`sitio: ${asset.kind}`, asset.url);
    }
    await measuredRequest('público: contenidos', `${api}/public/posts?section=leyendas`);
    await measuredRequest('público: torneo actual', `${api}/public/tournaments/current`);
    await measuredRequest('público: mapa', `${api}/public/tournaments/current/map`);
    if (livePhotos.length) await measuredRequest('público: foto en juego', livePhotos[index % livePhotos.length]);

    let cycle = 0;
    while (!interrupted && Date.now() < endAt) {
      await measuredRequest('público: torneo actual', `${api}/public/tournaments/current`);
      if (cycle % 3 === 0) await measuredRequest('público: mapa', `${api}/public/tournaments/current/map`);
      if (livePhotos.length && cycle % 3 === 0) await measuredRequest('público: foto en juego', livePhotos[(index + cycle) % livePhotos.length]);
      cycle += 1;
      await sleep(jitter(config.pollMs, 0.2));
    }
  } finally {
    activeUsers -= 1;
  }
}

async function measuredRequest(label, url, init = {}) {
  const start = performance.now();
  let status = 0;
  let bytes = 0;
  let error = null;
  try {
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: { Accept: 'application/json, text/html;q=0.9, */*;q=0.8', 'X-Copa-Load-Test': 'tournament-day', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    status = response.status;
    const content = await response.arrayBuffer();
    bytes = content.byteLength;
    if (!response.ok) error = `HTTP ${response.status}`;
  } catch (reason) {
    error = reason instanceof Error ? reason.message : String(reason);
  }
  record(label, performance.now() - start, status, bytes, error);
}

function record(label, durationMs, status, bytes, error) {
  const entry = metrics.get(label) ?? { label, requests: 0, errors: 0, bytes: 0, durations: [], statuses: {}, examples: [] };
  entry.requests += 1;
  entry.bytes += bytes;
  entry.durations.push(durationMs);
  const statusKey = status ? String(status) : 'network';
  entry.statuses[statusKey] = (entry.statuses[statusKey] ?? 0) + 1;
  if (error) {
    entry.errors += 1;
    if (entry.examples.length < 3 && !entry.examples.includes(error)) entry.examples.push(error);
  }
  metrics.set(label, entry);
}

async function preflight() {
  const target = `${api}/health`;
  let response;
  try {
    response = await fetch(target, { signal: AbortSignal.timeout(config.timeoutMs) });
  } catch (reason) {
    throw new Error(`No se pudo conectar con ${target}: ${reason instanceof Error ? reason.message : reason}`);
  }
  if (!response.ok) throw new Error(`El health check respondió HTTP ${response.status}: ${target}`);
}

async function discoverStaticAssets() {
  const response = await fetch(`${site}/`, { signal: AbortSignal.timeout(config.timeoutMs) });
  if (!response.ok) throw new Error(`No se pudo abrir el sitio para descubrir recursos: HTTP ${response.status}`);
  const html = await response.text();
  const paths = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)].map((match) => match[1]);
  return [...new Set(paths)].slice(0, 4).map((path) => ({
    url: new URL(path, `${site}/`).toString(),
    kind: path.split('?')[0].toLowerCase().endsWith('.css') ? 'CSS' : 'JavaScript',
  }));
}

async function discoverLivePhotos() {
  const response = await fetch(`${api}/public/tournaments/current`, { signal: AbortSignal.timeout(config.timeoutMs) });
  if (!response.ok) return [];
  const current = await response.json();
  const zoneMatches = current.tournament?.zones?.flatMap((zone) => zone.matches ?? []) ?? [];
  const knockoutMatches = current.tournament?.knockout?.flatMap((slot) => slot.match ? [slot.match] : []) ?? [];
  const paths = [...zoneMatches, ...knockoutMatches]
    .filter((match) => match.status === 'IN_PROGRESS' && match.photoUrl)
    .map((match) => match.photoUrl);
  return [...new Set(paths)].slice(0, 4).map((path) => new URL(path, `${api}/`).toString());
}

function buildReport() {
  const endpoints = [...metrics.values()].map(summarize).sort((left, right) => left.label.localeCompare(right.label, 'es'));
  const durations = [...metrics.values()].flatMap((entry) => entry.durations);
  const requests = endpoints.reduce((sum, entry) => sum + entry.requests, 0);
  const errors = endpoints.reduce((sum, entry) => sum + entry.errors, 0);
  const elapsedSeconds = Math.max((Date.now() - startedAt) / 1_000, 0.001);
  const global = {
    requests,
    errors,
    errorRate: requests ? errors / requests : 1,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    maxMs: durations.length ? Math.max(...durations) : 0,
    requestsPerSecond: requests / elapsedSeconds,
    elapsedSeconds,
  };
  const checks = [
    { name: `Errores ≤ ${(config.maxErrorRate * 100).toFixed(2)}%`, passed: global.errorRate <= config.maxErrorRate, value: `${(global.errorRate * 100).toFixed(2)}%` },
    { name: `p95 ≤ ${config.maxP95Ms} ms`, passed: global.p95Ms <= config.maxP95Ms, value: `${global.p95Ms.toFixed(0)} ms` },
    { name: `p99 ≤ ${config.maxP99Ms} ms`, passed: global.p99Ms <= config.maxP99Ms, value: `${global.p99Ms.toFixed(0)} ms` },
  ];
  return {
    generatedAt: new Date().toISOString(),
    passed: requests > 0 && checks.every((check) => check.passed) && !interrupted,
    interrupted,
    config: sanitizedConfig(),
    global,
    checks,
    endpoints,
  };
}

function summarize(entry) {
  return {
    label: entry.label,
    requests: entry.requests,
    errors: entry.errors,
    errorRate: entry.requests ? entry.errors / entry.requests : 0,
    p50Ms: percentile(entry.durations, 50),
    p95Ms: percentile(entry.durations, 95),
    p99Ms: percentile(entry.durations, 99),
    maxMs: entry.durations.length ? Math.max(...entry.durations) : 0,
    bytes: entry.bytes,
    statuses: entry.statuses,
    examples: entry.examples,
  };
}

function printProgress() {
  const entries = [...metrics.values()];
  const requests = entries.reduce((sum, entry) => sum + entry.requests, 0);
  const errors = entries.reduce((sum, entry) => sum + entry.errors, 0);
  const durations = entries.flatMap((entry) => entry.durations);
  const elapsed = Math.max((Date.now() - startedAt) / 1_000, 0.001);
  console.log(`[${elapsed.toFixed(0)}s] activos=${activeUsers} solicitudes=${requests} rps=${(requests / elapsed).toFixed(1)} errores=${errors} p95=${percentile(durations, 95).toFixed(0)}ms`);
}

function printReport(report) {
  console.log('\nResumen');
  console.log(`Solicitudes: ${report.global.requests} · RPS promedio: ${report.global.requestsPerSecond.toFixed(1)} · Errores: ${report.global.errors} (${(report.global.errorRate * 100).toFixed(2)}%)`);
  console.log(`Latencia: p50 ${report.global.p50Ms.toFixed(0)}ms · p95 ${report.global.p95Ms.toFixed(0)}ms · p99 ${report.global.p99Ms.toFixed(0)}ms · máxima ${report.global.maxMs.toFixed(0)}ms`);
  console.log('\nPor operación');
  console.log('Operación'.padEnd(40), 'Req'.padStart(6), 'Err'.padStart(6), 'p50'.padStart(8), 'p95'.padStart(8), 'p99'.padStart(8));
  for (const endpoint of report.endpoints) {
    console.log(endpoint.label.slice(0, 40).padEnd(40), String(endpoint.requests).padStart(6), String(endpoint.errors).padStart(6), `${endpoint.p50Ms.toFixed(0)}ms`.padStart(8), `${endpoint.p95Ms.toFixed(0)}ms`.padStart(8), `${endpoint.p99Ms.toFixed(0)}ms`.padStart(8));
    console.log(`  HTTP: ${Object.entries(endpoint.statuses).map(([status, count]) => `${status}=${count}`).join(' · ')}`);
    if (endpoint.examples.length) console.log(`  errores: ${endpoint.examples.join(' · ')}`);
  }
  console.log('\nUmbrales');
  for (const check of report.checks) console.log(`${check.passed ? 'OK' : 'FALLÓ'} · ${check.name} · observado ${check.value}`);
  console.log(`\nRESULTADO: ${report.passed ? 'APROBADO' : 'NO APROBADO'}`);
}

async function saveReport(report, output) {
  const file = resolve(output);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Informe JSON: ${file}`);
}

function percentile(values, requested) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((requested / 100) * sorted.length) - 1);
  return sorted[Math.max(index, 0)];
}

function jitter(value, ratio) {
  return Math.max(0, Math.round(value * (1 - ratio + Math.random() * ratio * 2)));
}

function sleep(milliseconds) {
  return new Promise((done) => setTimeout(done, milliseconds));
}

function sanitizedConfig() {
  const { help: _help, ...safe } = config;
  return safe;
}

function parseArguments(args) {
  const parsed = { ...defaults };
  const mapping = {
    '--api-url': ['apiUrl', String], '--site-url': ['siteUrl', String], '--users': ['users', Number],
    '--duration': ['durationSeconds', Number], '--ramp': ['rampSeconds', Number],
    '--poll-ms': ['pollMs', Number], '--timeout-ms': ['timeoutMs', Number], '--burst-rounds': ['burstRounds', Number],
    '--max-error-rate': ['maxErrorRate', Number], '--max-p95-ms': ['maxP95Ms', Number], '--max-p99-ms': ['maxP99Ms', Number],
    '--output': ['output', String],
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--allow-remote') { parsed.allowRemote = true; continue; }
    if (argument === '--help' || argument === '-h') { parsed.help = true; continue; }
    const target = mapping[argument];
    if (!target) throw new Error(`Opción desconocida: ${argument}. Usá --help para ver las opciones.`);
    const value = args[++index];
    if (value === undefined) throw new Error(`Falta el valor de ${argument}.`);
    parsed[target[0]] = target[1](value);
  }
  return parsed;
}

function validateConfig(value) {
  const apiTarget = new URL(value.apiUrl);
  if (!value.apiUrl.replace(/\/+$/, '').endsWith('/api')) throw new Error('--api-url debe terminar en /api.');
  const targets = [apiTarget, ...(value.siteUrl ? [new URL(value.siteUrl)] : [])];
  if (!value.allowRemote && targets.some((target) => !isLocalHost(target.hostname))) {
    throw new Error('Por seguridad, los destinos remotos requieren --allow-remote. Confirmá antes que tenés autorización para probarlos.');
  }
  for (const [name, number, minimum] of [
    ['users', value.users, 1], ['duration', value.durationSeconds, 1],
    ['ramp', value.rampSeconds, 0], ['poll-ms', value.pollMs, 100], ['timeout-ms', value.timeoutMs, 100], ['burst-rounds', value.burstRounds, 0],
  ]) if (!Number.isFinite(number) || number < minimum || !Number.isInteger(number)) throw new Error(`Valor inválido para --${name}.`);
  if (value.maxErrorRate < 0 || value.maxErrorRate > 1) throw new Error('--max-error-rate debe estar entre 0 y 1.');
  if (value.maxP95Ms <= 0 || value.maxP99Ms <= 0) throw new Error('Los umbrales de latencia deben ser positivos.');
}

function isLocalHost(hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase());
}

function defaultLocalApiUrl() {
  if (process.env.LOAD_TEST_API_URL?.trim()) return process.env.LOAD_TEST_API_URL.trim();
  try {
    const match = readFileSync(resolve('backend/.env'), 'utf8').match(/^PORT\s*=\s*(\d+)\s*$/m);
    if (match) return `http://localhost:${match[1]}/api`;
  } catch { /* Usa el puerto convencional cuando todavía no existe backend/.env. */ }
  return 'http://localhost:3000/api';
}

function printHelp() {
  console.log(`Uso: npm run test:load -- [opciones]

Prueba segura y sin mutaciones deportivas para simular el día del torneo.

Opciones principales:
  --api-url URL          API terminada en /api (default: PORT de backend/.env)
  --site-url URL         Opcional: incluye HTML, CSS y JavaScript del sitio
  --users N              Usuarios virtuales máximos (default: 30)
  --duration SEGUNDOS    Carga sostenida después de la rampa (default: 60)
  --ramp SEGUNDOS        Tiempo para subir gradualmente a N usuarios (default: 10)
  --poll-ms MS           Pausa por usuario; 3000 equivale a 5× el refresco público real
  --burst-rounds N       Ráfagas finales de N solicitudes simultáneas (default: 3)
  --timeout-ms MS        Timeout por solicitud (default: 5000)
  --output ARCHIVO       Guarda también el informe completo como JSON

Umbrales:
  --max-error-rate N     Fracción máxima de errores (default: 0.01)
  --max-p95-ms MS        p95 máximo aceptable (default: 1000)
  --max-p99-ms MS        p99 máximo aceptable (default: 2000)

Seguridad:
  --allow-remote         Obligatorio para cualquier host que no sea localhost
  -h, --help             Muestra esta ayuda
`);
}
