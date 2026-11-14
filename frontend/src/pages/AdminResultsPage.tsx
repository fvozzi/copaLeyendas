import { useEffect, useMemo, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { getTournamentOperations, openMatchResultPhoto, saveMatchResult, startMatch } from '../lib/api';
import { pairPlayerNames } from '../lib/pair-display';
import type { TournamentOperations, TournamentScheduleSlot } from '../types';

const pairName = (slot: TournamentScheduleSlot, side: 'home' | 'away') => {
  const pair = side === 'home' ? slot.match?.homeRegistration : slot.match?.awayRegistration;
  return pair ? `${pair.locality.name} · ${pairPlayerNames(pair)}` : 'A definir';
};

export function AdminResultsPage() {
  const [data, setData] = useState<TournamentOperations | null>(null);
  const [courtId, setCourtId] = useState(0);
  const [starting, setStarting] = useState<TournamentScheduleSlot | null>(null);
  const [editing, setEditing] = useState<TournamentScheduleSlot | null>(null);
  const [scores, setScores] = useState({ home: 25, away: 0 });
  const [startPhoto, setStartPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const result = await getTournamentOperations();
    setData(result);
    setCourtId((current) => result.courts.some((court) => court.id === current) ? current : (result.courts[0]?.id ?? 0));
  };
  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, []);

  const slots = useMemo(() => (data?.slots ?? [])
    .filter((slot) => slot.courtId === courtId)
    .sort((left, right) => (left.scheduledAt ?? '9999').localeCompare(right.scheduledAt ?? '9999') || left.sequence - right.sequence), [data, courtId]);

  const begin = (slot: TournamentScheduleSlot) => {
    const target = slot.tournamentCategory.pointsPerSet;
    setEditing(slot); setScores({ home: target, away: 0 }); setError(null);
  };
  const beginStart = (slot: TournamentScheduleSlot) => {
    setStarting(slot); setStartPhoto(null); setError(null);
  };
  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!starting?.matchId || !startPhoto) return;
    setBusy(true); setError(null);
    try {
      await startMatch(starting.matchId, startPhoto);
      setStarting(null); setStartPhoto(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar el partido.'); }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing?.matchId) return;
    setBusy(true); setError(null);
    try {
      await saveMatchResult(editing.matchId, scores.home, scores.away);
      setEditing(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el resultado.'); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="admin-panel inline-state">{error ?? 'Cargando partidos...'}</div>;
  const court = data.courts.find((item) => item.id === courtId);
  return <div className="admin-panel court-results-page">
    <div className="panel-header"><div><p className="eyebrow">Operación de cancha</p><h1>Cargar resultados</h1><p>{data.tournament?.name ?? 'No hay un torneo activo.'}</p></div></div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    {!data.tournament ? <div className="inline-state">No hay un torneo activo.</div> : !data.courts.length ? <div className="inline-state">No tenés partidos en las sedes asignadas. Dirección debe asignarte desde Sedes.</div> : <>
      <section className="data-card result-court-selector"><label>Cancha<select value={courtId} onChange={(event) => setCourtId(Number(event.target.value))}>{data.courts.map((item) => <option key={item.id} value={item.id}>{item.venue?.name ? `${item.venue.name} · ` : ''}{item.name}</option>)}</select></label><p className="field-hint">{court?.venue?.address ?? court?.address ?? 'Ubicación sin informar'} · {slots.length} partidos</p></section>
      <section className="data-card"><AdminDataGrid rows={slots} emptyMessage="No hay partidos programados en esta cancha." columns={[
        { label: 'Horario', render: (slot) => slot.scheduledAt ? new Intl.DateTimeFormat('es-AR', { timeStyle: 'short', dateStyle: 'short' }).format(new Date(slot.scheduledAt)) : 'A definir' },
        { label: 'Partido', render: (slot) => <strong>P{slot.sequence} · {slot.tournamentCategory.category.name}</strong> },
        { label: 'Etapa', render: (slot) => slot.zoneName },
        { label: 'Local', render: (slot) => pairName(slot, 'home') },
        { label: 'Visitante', render: (slot) => pairName(slot, 'away') },
        { label: 'Estado', render: (slot) => slot.match?.status === 'PLAYED' ? <strong>{slot.match.homeScore} - {slot.match.awayScore}</strong> : slot.match?.status === 'IN_PROGRESS' ? <span className="status-chip status-live"><span className="live-dot" />En juego</span> : slot.match?.status === 'READY' ? 'Listo para jugar' : 'A definir' },
      ]} renderActions={(slot) => <>{slot.match?.status === 'READY' && <button type="button" className="primary-button" disabled={busy} onClick={() => beginStart(slot)}>Iniciar partido</button>}{slot.match?.status === 'IN_PROGRESS' && <button type="button" className="primary-button" disabled={busy} onClick={() => begin(slot)}>Cargar resultado</button>}{slot.match?.resultPhotoAvailable && <button type="button" className="inline-link" onClick={() => void openMatchResultPhoto(slot.matchId!)}>Ver foto</button>}</>} /></section>
    </>}
    {starting?.match && <AdminDialog title={`Iniciar P${starting.sequence}`} onClose={() => { if (!busy) setStarting(null); }}><form className="editor-form" onSubmit={start}>
      {error && <div className="inline-state span-2" role="alert">{error}</div>}
      <p className="field-hint span-2">Esta foto marca el inicio del partido y se publica inmediatamente como “En juego”.</p>
      <div className="match-photo-orientation span-2"><div><span>Izquierda · Local</span><strong>{pairName(starting, 'home')}</strong></div><div><span>Derecha · Visitante</span><strong>{pairName(starting, 'away')}</strong></div></div>
      <label className="span-2 result-photo-field">Foto inicial del partido<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => setStartPhoto(event.target.files?.[0] ?? null)} required /><small>Ubicá a la pareja local a la izquierda y a la visitante a la derecha. Al finalizar agregaremos automáticamente equipos, tantos y logo.</small></label>
      <div className="span-2 form-actions"><button className="primary-button" disabled={busy || !startPhoto}>{busy ? 'Publicando...' : 'Publicar e iniciar partido'}</button></div>
    </form></AdminDialog>}
    {editing?.match && <AdminDialog title={`Resultado P${editing.sequence}`} onClose={() => { if (!busy) setEditing(null); }}><form className="editor-form" onSubmit={save}>
      {error && <div className="inline-state span-2" role="alert">{error}</div>}
      <p className="field-hint span-2">{editing.tournamentCategory.category.name} · {editing.zoneName}</p>
      <label>{pairName(editing, 'home')}<input aria-label="Tantos local" type="number" min="0" max={editing.tournamentCategory.pointsPerSet} value={scores.home} onChange={(event) => setScores({ ...scores, home: Number(event.target.value) })} required /></label>
      <label>{pairName(editing, 'away')}<input aria-label="Tantos visitante" type="number" min="0" max={editing.tournamentCategory.pointsPerSet} value={scores.away} onChange={(event) => setScores({ ...scores, away: Number(event.target.value) })} required /></label>
      <p className="field-hint span-2">Uno de los dos equipos debe llegar a {editing.tournamentCategory.pointsPerSet} tantos.</p>
      <p className="field-hint span-2">Al confirmar, el sistema editará la foto inicial con los equipos, los tantos y el logo de Copa Leyendas.</p>
      <div className="span-2 form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Generando placa...' : 'Confirmar resultado'}</button></div>
    </form></AdminDialog>}
  </div>;
}
