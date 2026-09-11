import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { useAuth } from '../lib/auth';
import { assignZonePlace, generateZoneFixture, getAvailableZoneRegistrations, getZone, getZoneMatches, saveMatchResult, updateMatchSchedule } from '../lib/api';
import type { PairRegistration, TournamentMatch, ZoneDetail } from '../types';

const dateTimeValue = (value: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
const formattedDateTime = (value: string | null) => value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Sin horario';
const pairName = (pair: PairRegistration) => `${pair.playerOneName} / ${pair.playerTwoName} - ${pair.localityName}`;

export function AdminZonePage() {
  const { user } = useAuth();
  const { id } = useParams();
  const zoneId = Number(id);
  const director = user?.role === 'DIRECTOR';
  const [zone, setZone] = useState<ZoneDetail | null>(null);
  const [available, setAvailable] = useState<PairRegistration[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [resultMatch, setResultMatch] = useState<TournamentMatch | null>(null);
  const [scheduleMatch, setScheduleMatch] = useState<TournamentMatch | null>(null);
  const [score, setScore] = useState({ home: 25, away: 0 });
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [item, games] = await Promise.all([getZone(zoneId), getZoneMatches(zoneId)]);
    const choices = director ? await getAvailableZoneRegistrations(item.tournamentCategoryId) : [];
    setZone(item); setMatches(games); setAvailable(choices); setSelected({});
  };
  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, [zoneId, director]);
  const run = async (action: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : message); }
    finally { setBusy(false); }
  };
  const result = async (event: React.FormEvent) => {
    event.preventDefault(); if (!resultMatch) return;
    await run(async () => { await saveMatchResult(resultMatch.id, score.home, score.away); setResultMatch(null); }, 'No se pudo guardar el resultado.');
  };
  const schedule = async (event: React.FormEvent) => {
    event.preventDefault(); if (!scheduleMatch || !scheduledAt) return;
    await run(async () => { await updateMatchSchedule(scheduleMatch.id, new Date(scheduledAt).toISOString()); setScheduleMatch(null); }, 'No se pudo guardar el horario.');
  };

  if (!zone) return <div className="admin-panel inline-state">{error ?? 'Cargando zona...'}</div>;
  const locked = matches.some((match) => match.status === 'PLAYED');
  const capacity = matches.length === 3 ? 3 : zone.capacity;
  const legacySeeds = zone.entries.some((entry) => !entry.seed) || new Set(zone.entries.map((entry) => entry.seed)).size !== zone.entries.length;
  const places = Array.from({ length: capacity }, (_, index) => ({ id: index + 1, entry: zone.entries.find((entry, entryIndex) => (legacySeeds ? entryIndex + 1 : entry.seed) === index + 1) }));
  const participant = (match: TournamentMatch, side: 'home' | 'away') => {
    const registration = side === 'home' ? match.homeRegistration : match.awayRegistration;
    if (registration) return pairName(registration);
    const source = side === 'home' ? match.homeSource : match.awaySource;
    const sourceId = side === 'home' ? match.homeSourceMatchId : match.awaySourceMatchId;
    if (source === 'WINNER' || source === 'LOSER') return `${source === 'WINNER' ? 'Ganadora' : 'Perdedora'} P${matches.find((item) => item.id === sourceId)?.matchOrder ?? '?'}`;
    const pairing = (capacity === 3 ? [[1, 2], [1, 3], [2, 3]] : [[1, 2], [3, 4]])[match.matchOrder - 1];
    return pairing ? `Pareja ${pairing[side === 'home' ? 0 : 1]} · A definir` : 'Según resultado previo';
  };

  return <div className="admin-panel">
    <div className="panel-header"><div><p className="eyebrow">{zone.tournamentCategory.category.name}</p><h1>{zone.name}</h1><p>Cupo {zone.entries.length}/{capacity}</p></div>
      {director && <button className="primary-button" onClick={() => void run(() => generateZoneFixture(zoneId), 'No se pudo generar el fixture.')} disabled={busy || matches.length > 0}>{busy ? 'Guardando...' : matches.length ? 'Fixture generado' : 'Generar fixture'}</button>}
    </div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    {director && <section className="data-card"><h2>Parejas de la zona</h2>
      <p>{locked ? 'Las parejas no se pueden reemplazar porque ya hay resultados cargados.' : 'Podés generar los partidos ahora y completar o reemplazar cada pareja después, conservando los horarios.'}</p>
      <AdminDataGrid rows={places} emptyMessage="La zona no tiene lugares disponibles." columns={[
        { label: 'Lugar', render: (place) => <strong>Pareja {place.id}</strong> },
        { label: 'Pareja asignada', render: (place) => place.entry ? pairName(place.entry.registration) : 'A definir' },
        { label: 'Asignación', render: (place) => <div className="list-actions"><select aria-label={`Asignar pareja ${place.id}`} value={selected[place.id] ?? place.entry?.registration.id ?? 0} disabled={busy || locked} onChange={(event) => setSelected((current) => ({ ...current, [place.id]: Number(event.target.value) }))}>
          <option value="0">Seleccionar pareja confirmada</option>
          {place.entry ? <option value={place.entry.registration.id}>{pairName(place.entry.registration)}</option> : null}
          {available.map((entry) => <option key={entry.id} value={entry.id}>{pairName(entry)}</option>)}
        </select><button className="secondary-button" disabled={busy || locked || !selected[place.id] || selected[place.id] === place.entry?.registration.id} onClick={() => void run(() => assignZonePlace(zoneId, place.id, selected[place.id]), 'No se pudo asignar la pareja.')}>{place.entry ? 'Reemplazar' : 'Asignar pareja'}</button></div> },
      ]} />
    </section>}
    <section className="data-card"><h2>Fixture y resultados</h2>
      <AdminDataGrid rows={matches} emptyMessage="Generá el fixture para crear los partidos, aunque todavía no tengas parejas asignadas." columns={[
        { label: 'Partido', render: (match) => `P${match.matchOrder}` },
        { label: 'Cancha', render: (match) => match.court?.name ?? 'A definir' },
        { label: 'Horario', render: (match) => formattedDateTime(match.scheduledAt) },
        { label: 'Local', render: (match) => participant(match, 'home') },
        { label: 'Visitante', render: (match) => participant(match, 'away') },
        { label: 'Resultado', render: (match) => match.homeScore === null ? '-' : `${match.homeScore} - ${match.awayScore}` },
        { label: 'Estado', render: (match) => ({ PENDING: 'Pendiente', READY: 'Listo', PLAYED: 'Jugado' }[match.status] ?? match.status) },
      ]} renderActions={(match) => <>{match.status !== 'PLAYED' && <button className="inline-link" disabled={busy} onClick={() => { setScheduleMatch(match); setScheduledAt(dateTimeValue(match.scheduledAt)); }}>Horario</button>}{match.status === 'READY' && <button className="inline-link" disabled={busy} onClick={() => { setResultMatch(match); setScore({ home: 25, away: 0 }); }}>Resultado</button>}</>} />
    </section>
    {resultMatch && <AdminDialog title={`Resultado P${resultMatch.matchOrder}`} onClose={() => setResultMatch(null)}><form className="editor-form" onSubmit={result}><label>Local<input type="number" min="0" value={score.home} onChange={(event) => setScore({ ...score, home: Number(event.target.value) })} /></label><label>Visitante<input type="number" min="0" value={score.away} onChange={(event) => setScore({ ...score, away: Number(event.target.value) })} /></label><div className="span-2 form-actions"><button className="primary-button" disabled={busy}>Guardar resultado</button></div></form></AdminDialog>}
    {scheduleMatch && <AdminDialog title={`Horario P${scheduleMatch.matchOrder}`} onClose={() => setScheduleMatch(null)}><form className="editor-form" onSubmit={schedule}><label className="span-2">Fecha y hora<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></label><div className="span-2 form-actions"><button className="primary-button" disabled={busy}>Guardar horario</button></div></form></AdminDialog>}
  </div>;
}
