import { useEffect, useMemo, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { getTournamentOperations, openMatchResultPhoto, saveMatchResult } from '../lib/api';
import type { TournamentOperations, TournamentScheduleSlot } from '../types';

const pairName = (slot: TournamentScheduleSlot, side: 'home' | 'away') => {
  const pair = side === 'home' ? slot.match?.homeRegistration : slot.match?.awayRegistration;
  return pair ? `${pair.locality.name} · ${pair.playerOneName} / ${pair.playerTwoName}` : 'A definir';
};

export function AdminResultsPage() {
  const [data, setData] = useState<TournamentOperations | null>(null);
  const [courtId, setCourtId] = useState(0);
  const [editing, setEditing] = useState<TournamentScheduleSlot | null>(null);
  const [scores, setScores] = useState({ home: 25, away: 0 });
  const [photo, setPhoto] = useState<File | null>(null);
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
    setEditing(slot); setScores({ home: target, away: 0 }); setPhoto(null); setError(null);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing?.matchId || !photo) return;
    setBusy(true); setError(null);
    try {
      await saveMatchResult(editing.matchId, scores.home, scores.away, photo);
      setEditing(null); setPhoto(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el resultado.'); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="admin-panel inline-state">{error ?? 'Cargando partidos...'}</div>;
  const court = data.courts.find((item) => item.id === courtId);
  return <div className="admin-panel court-results-page">
    <div className="panel-header"><div><p className="eyebrow">Operación de cancha</p><h1>Cargar resultados</h1><p>{data.tournament?.name ?? 'No hay un torneo activo.'}</p></div></div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    {!data.tournament ? <div className="inline-state">No hay un torneo activo.</div> : !data.courts.length ? <div className="inline-state">No tenés canchas con partidos asignados. Dirección debe asignarte desde Canchas.</div> : <>
      <section className="data-card result-court-selector"><label>Cancha<select value={courtId} onChange={(event) => setCourtId(Number(event.target.value))}>{data.courts.map((item) => <option key={item.id} value={item.id}>{item.venue?.name ? `${item.venue.name} · ` : ''}{item.name}</option>)}</select></label><p className="field-hint">{court?.venue?.address ?? court?.address ?? 'Ubicación sin informar'} · {slots.length} partidos</p></section>
      <section className="data-card"><AdminDataGrid rows={slots} emptyMessage="No hay partidos programados en esta cancha." columns={[
        { label: 'Horario', render: (slot) => slot.scheduledAt ? new Intl.DateTimeFormat('es-AR', { timeStyle: 'short', dateStyle: 'short' }).format(new Date(slot.scheduledAt)) : 'A definir' },
        { label: 'Partido', render: (slot) => <strong>P{slot.sequence} · {slot.tournamentCategory.category.name}</strong> },
        { label: 'Etapa', render: (slot) => slot.zoneName },
        { label: 'Local', render: (slot) => pairName(slot, 'home') },
        { label: 'Visitante', render: (slot) => pairName(slot, 'away') },
        { label: 'Estado', render: (slot) => slot.match?.status === 'PLAYED' ? <strong>{slot.match.homeScore} - {slot.match.awayScore}</strong> : slot.match?.status === 'READY' ? 'Listo para jugar' : 'A definir' },
      ]} renderActions={(slot) => <>{slot.match?.status === 'READY' && <button type="button" className="primary-button" disabled={busy} onClick={() => begin(slot)}>Cargar resultado</button>}{slot.match?.status === 'PLAYED' && slot.match.resultPhotoAvailable && <button type="button" className="inline-link" onClick={() => void openMatchResultPhoto(slot.matchId!)}>Ver foto</button>}</>} /></section>
    </>}
    {editing?.match && <AdminDialog title={`Resultado P${editing.sequence}`} onClose={() => { if (!busy) setEditing(null); }}><form className="editor-form" onSubmit={save}>
      {error && <div className="inline-state span-2" role="alert">{error}</div>}
      <p className="field-hint span-2">{editing.tournamentCategory.category.name} · {editing.zoneName}</p>
      <label>{pairName(editing, 'home')}<input aria-label="Tantos local" type="number" min="0" max={editing.tournamentCategory.pointsPerSet} value={scores.home} onChange={(event) => setScores({ ...scores, home: Number(event.target.value) })} required /></label>
      <label>{pairName(editing, 'away')}<input aria-label="Tantos visitante" type="number" min="0" max={editing.tournamentCategory.pointsPerSet} value={scores.away} onChange={(event) => setScores({ ...scores, away: Number(event.target.value) })} required /></label>
      <p className="field-hint span-2">Uno de los dos equipos debe llegar a {editing.tournamentCategory.pointsPerSet} tantos.</p>
      <label className="span-2 result-photo-field">Foto de la planilla o tablero<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} required /><small>Podés sacar la foto directamente con la cámara del teléfono.</small></label>
      <div className="span-2 form-actions"><button className="primary-button" disabled={busy || !photo}>{busy ? 'Guardando...' : 'Confirmar resultado'}</button></div>
    </form></AdminDialog>}
  </div>;
}
