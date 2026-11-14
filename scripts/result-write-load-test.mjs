#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const defaults = {
  apiUrl: defaultLocalApiUrl(),
  category: 'Damas B',
  count: 7,
  matchIds: [],
  awayScore: 10,
  photo: 'frontend/public/LogoFemme.png',
  timeoutMs: 60_000,
  maxStartP95Ms: 10_000,
  maxResultP95Ms: 30_000,
  confirmWrites: false,
  output: '',
  token: process.env.LOAD_TEST_TOKEN ?? '',
  email: process.env.LOAD_TEST_EMAIL ?? '',
  password: process.env.LOAD_TEST_PASSWORD ?? '',
};

let config;
try {
  config = parseArguments(process.argv.slice(2));
  if (config.help) { printHelp(); process.exit(0); }
  await run();
} catch (reason) {
  console.error(`\nERROR: ${reason instanceof Error ? reason.message : reason}`);
  process.exitCode = 2;
}

async function run() {
  validateConfig(config);
  const api = config.apiUrl.replace(/\/+$/, '');
  console.log('Prueba LOCAL de escritura simultánea de resultados');
  console.log(`API: ${api} · categoría: ${config.category} · concurrencia: ${config.matchIds.length || config.count}`);
  console.log('ATENCIÓN: esta prueba inicia partidos, guarda fotos y carga resultados. Restaurá el backup local al terminar.');

  await expectOk(`${api}/health`);
  const token = config.token || await login(api, config.email, config.password);
  const operations = await authorizedJson(`${api}/tournaments/operations`, token);
  const slots = selectSlots(operations.slots ?? []);
  const photoPath = resolve(config.photo);
  const photoBuffer = await readFile(photoPath);
  const photoType = mimeType(photoPath);
  const photoBlob = new Blob([photoBuffer], { type: photoType });

  console.log('\nPartidos seleccionados:');
  for (const slot of slots) console.log(`P${slot.sequence} · match ${slot.matchId} · ${slot.tournamentCategory.category.name} · ${slot.zoneName}`);

  const starts = await Promise.all(slots.map((slot) => startMatch(api, token, slot, photoBlob, photoPath)));
  printPhase('Inicio con foto', starts);
  if (starts.some((result) => !result.ok)) {
    throw new Error('Algún inicio falló. No se enviaron resultados; restaurá el backup porque otros partidos pueden haber quedado En juego.');
  }

  const results = await Promise.all(slots.map((slot) => submitResult(api, token, slot)));
  printPhase('Cierre con resultado y placa', results);

  const refreshed = await authorizedJson(`${api}/tournaments/operations`, token);
  const finalByMatch = new Map((refreshed.slots ?? []).map((slot) => [slot.matchId, slot.match]));
  const verification = slots.map((slot) => ({
    matchId: slot.matchId,
    status: finalByMatch.get(slot.matchId)?.status ?? 'NO_VISIBLE',
    homeScore: finalByMatch.get(slot.matchId)?.homeScore ?? null,
    awayScore: finalByMatch.get(slot.matchId)?.awayScore ?? null,
  }));
  const startP95Ms = percentile(starts.map((item) => item.durationMs), 95);
  const resultP95Ms = percentile(results.map((item) => item.durationMs), 95);
  const checks = [
    { name: 'Todos los inicios respondieron correctamente', passed: starts.every((item) => item.ok) },
    { name: 'Todos los resultados respondieron correctamente', passed: results.every((item) => item.ok) },
    { name: 'Todos los partidos quedaron PLAYED', passed: verification.every((item) => item.status === 'PLAYED') },
    { name: `p95 de inicio ≤ ${config.maxStartP95Ms} ms`, passed: startP95Ms <= config.maxStartP95Ms },
    { name: `p95 de resultado ≤ ${config.maxResultP95Ms} ms`, passed: resultP95Ms <= config.maxResultP95Ms },
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    passed: checks.every((check) => check.passed),
    config: sanitizedConfig(),
    startP95Ms,
    resultP95Ms,
    starts,
    results,
    verification,
    checks,
  };

  console.log('\nVerificación final');
  for (const item of verification) console.log(`match ${item.matchId}: ${item.status} · ${item.homeScore}-${item.awayScore}`);
  console.log('\nUmbrales');
  for (const check of checks) console.log(`${check.passed ? 'OK' : 'FALLÓ'} · ${check.name}`);
  console.log(`\nRESULTADO: ${report.passed ? 'APROBADO' : 'NO APROBADO'}`);
  if (config.output) await saveReport(report, config.output);
  process.exitCode = report.passed ? 0 : 1;

  function selectSlots(allSlots) {
    const requested = new Set(config.matchIds);
    const candidates = allSlots.filter((slot) => slot.matchId && slot.match?.status === 'READY' && slot.match.homeRegistration && slot.match.awayRegistration);
    const selected = requested.size
      ? candidates.filter((slot) => requested.has(slot.matchId))
      : candidates.filter((slot) => normalized(slot.tournamentCategory?.category?.name) === normalized(config.category)).slice(0, config.count);
    const expected = requested.size || config.count;
    if (selected.length !== expected) {
      const available = candidates.filter((slot) => normalized(slot.tournamentCategory?.category?.name) === normalized(config.category));
      throw new Error(`Se necesitan ${expected} partidos READY completos y se encontraron ${selected.length}. Disponibles en ${config.category}: ${available.length}.`);
    }
    return selected;
  }
}

async function startMatch(api, token, slot, photoBlob, photoPath) {
  const form = new FormData();
  form.set('photo', photoBlob, basename(photoPath));
  return timedRequest('inicio', slot.matchId, `${api}/tournaments/matches/${slot.matchId}/start`, {
    method: 'POST', headers: authHeaders(token), body: form,
  });
}

async function submitResult(api, token, slot) {
  const target = slot.tournamentCategory.pointsPerSet ?? 25;
  if (config.awayScore >= target) throw new Error(`--away-score debe ser menor que ${target} para P${slot.sequence}.`);
  return timedRequest('resultado', slot.matchId, `${api}/tournaments/matches/${slot.matchId}/result`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ homeScore: target, awayScore: config.awayScore }),
  });
}

async function timedRequest(phase, matchId, url, init) {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      ...init,
      headers: { 'X-Copa-Load-Test': 'result-write-local', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const body = await response.text();
    return {
      phase, matchId, ok: response.ok, status: response.status,
      durationMs: Math.round(performance.now() - started),
      requestId: response.headers.get('x-request-id'),
      error: response.ok ? null : responseError(body),
    };
  } catch (reason) {
    return { phase, matchId, ok: false, status: 0, durationMs: Math.round(performance.now() - started), requestId: null, error: reason instanceof Error ? reason.message : String(reason) };
  }
}

async function login(api, email, password) {
  if (!email || !password) throw new Error('Definí LOAD_TEST_TOKEN o LOAD_TEST_EMAIL y LOAD_TEST_PASSWORD.');
  const response = await fetch(`${api}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Copa-Load-Test': 'result-write-local' },
    body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) throw new Error(`El login respondió HTTP ${response.status}.`);
  const payload = await response.json();
  if (!payload.accessToken) throw new Error('El login no devolvió accessToken.');
  return payload.accessToken;
}

async function authorizedJson(url, token) {
  const response = await fetch(url, { headers: authHeaders(token), signal: AbortSignal.timeout(config.timeoutMs) });
  if (!response.ok) throw new Error(`${url} respondió HTTP ${response.status}.`);
  return response.json();
}

async function expectOk(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(config.timeoutMs) });
  } catch (reason) {
    throw new Error(`No se pudo conectar con ${url}. Levantá el backend local y verificá su PORT. Detalle: ${reason instanceof Error ? reason.message : reason}`);
  }
  if (!response.ok) throw new Error(`${url} respondió HTTP ${response.status}.`);
}

function printPhase(name, items) {
  console.log(`\n${name}`);
  for (const item of items) console.log(`match ${item.matchId}: ${item.ok ? 'OK' : 'ERROR'} · HTTP ${item.status || 'red'} · ${item.durationMs} ms${item.error ? ` · ${item.error}` : ''}`);
  console.log(`p95: ${percentile(items.map((item) => item.durationMs), 95).toFixed(0)} ms`);
}

function responseError(body) {
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed.message) ? parsed.message.join('; ') : parsed.message ?? body.slice(0, 300);
  } catch { return body.slice(0, 300); }
}

function percentile(values, requested) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(requested / 100 * sorted.length) - 1))];
}

function authHeaders(token) { return { Authorization: `Bearer ${token}` }; }
function normalized(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }

function defaultLocalApiUrl() {
  if (process.env.LOAD_TEST_API_URL?.trim()) return process.env.LOAD_TEST_API_URL.trim();
  try {
    const match = readFileSync(resolve('backend/.env'), 'utf8').match(/^PORT\s*=\s*(\d+)\s*$/m);
    if (match) return `http://localhost:${match[1]}/api`;
  } catch { /* Usa el puerto convencional cuando todavía no existe backend/.env. */ }
  return 'http://localhost:3000/api';
}

function mimeType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.heic') return 'image/heic';
  if (extension === '.heif') return 'image/heif';
  return 'image/png';
}

function validateConfig(value) {
  const target = new URL(value.apiUrl);
  if (!value.apiUrl.replace(/\/+$/, '').endsWith('/api')) throw new Error('--api-url debe terminar en /api.');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.hostname.toLowerCase())) throw new Error('Esta prueba de escritura solo puede ejecutarse contra localhost.');
  if (!value.confirmWrites) throw new Error('Falta --confirm-local-writes. La prueba modifica resultados locales de forma intencional.');
  for (const [name, number, minimum] of [['count', value.count, 1], ['away-score', value.awayScore, 0], ['timeout-ms', value.timeoutMs, 100]]) {
    if (!Number.isInteger(number) || number < minimum) throw new Error(`Valor inválido para --${name}.`);
  }
  if (!value.matchIds.length && !value.category.trim()) throw new Error('Indicá --category o --match-ids.');
}

function parseArguments(args) {
  const parsed = { ...defaults };
  const mapping = {
    '--api-url': ['apiUrl', String], '--category': ['category', String], '--count': ['count', Number],
    '--away-score': ['awayScore', Number], '--photo': ['photo', String], '--timeout-ms': ['timeoutMs', Number],
    '--max-start-p95-ms': ['maxStartP95Ms', Number], '--max-result-p95-ms': ['maxResultP95Ms', Number],
    '--output': ['output', String], '--token': ['token', String], '--email': ['email', String], '--password': ['password', String],
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--confirm-local-writes') { parsed.confirmWrites = true; continue; }
    if (argument === '--help' || argument === '-h') { parsed.help = true; continue; }
    if (argument === '--match-ids') {
      const value = args[++index];
      if (!value) throw new Error('Falta el valor de --match-ids.');
      parsed.matchIds = value.split(',').map(Number);
      if (parsed.matchIds.some((id) => !Number.isInteger(id) || id < 1)) throw new Error('--match-ids debe ser una lista de números separados por coma.');
      continue;
    }
    const target = mapping[argument];
    if (!target) throw new Error(`Opción desconocida: ${argument}. Usá --help.`);
    const value = args[++index];
    if (value === undefined) throw new Error(`Falta el valor de ${argument}.`);
    parsed[target[0]] = target[1](value);
  }
  return parsed;
}

function sanitizedConfig() {
  const { token: _token, email: _email, password: _password, help: _help, ...safe } = config;
  return safe;
}

async function saveReport(report, output) {
  const file = resolve(output);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Informe JSON: ${file}`);
}

function printHelp() {
  console.log(`Uso: npm run test:load:results -- --confirm-local-writes [opciones]

Inicia y finaliza simultáneamente partidos READY en la base LOCAL. Nunca admite un host remoto.

  --category NOMBRE          Categoría a probar (default: Damas B)
  --count N                  Partidos concurrentes (default: 7)
  --match-ids 1,2,3          Usa partidos específicos en vez de selección automática
  --away-score N             Tantos visitantes (default: 10)
  --photo ARCHIVO            Foto enviada en cada inicio (default: LogoFemme.png)
  --timeout-ms MS            Timeout individual (default: 60000)
  --max-start-p95-ms MS      Umbral de inicio (default: 10000)
  --max-result-p95-ms MS     Umbral de placa final (default: 30000)
  --output ARCHIVO           Informe JSON opcional
  --confirm-local-writes     Confirmación obligatoria

Autenticación: LOAD_TEST_TOKEN o LOAD_TEST_EMAIL + LOAD_TEST_PASSWORD.
Restaurá el backup local al finalizar la prueba.
`);
}
