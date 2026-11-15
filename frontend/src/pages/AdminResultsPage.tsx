import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { getTournamentOperations, openMatchResultPhoto, saveMatchResult, startMatch } from '../lib/api';
import { pairPlayerNames } from '../lib/pair-display';
import { clearMatchStartDraft, loadMatchStartDraft, saveMatchStartDraft } from '../lib/match-start-draft';
import type { TournamentOperations, TournamentScheduleSlot } from '../types';

const pairName = (slot: TournamentScheduleSlot, side: 'home' | 'away') => {
  const pair = side === 'home' ? slot.match?.homeRegistration : slot.match?.awayRegistration;
  return pair ? `${pair.locality.name} · ${pairPlayerNames(pair)}` : 'A definir';
};
const byOperationPriority = (left: TournamentScheduleSlot, right: TournamentScheduleSlot) => {
  const priority = (slot: TournamentScheduleSlot) => {
    if (slot.match?.status === 'IN_PROGRESS') return 0;
    if (slot.match?.status === 'READY') return 1;
    if (slot.match?.status === 'PLAYED') return 3;
    return 2;
  };
  return priority(left) - priority(right) || left.sequence - right.sequence;
};

export function AdminResultsPage() {
  const [data, setData] = useState<TournamentOperations | null>(null);
  const [starting, setStarting] = useState<TournamentScheduleSlot | null>(null);
  const [editing, setEditing] = useState<TournamentScheduleSlot | null>(null);
  const [scores, setScores] = useState({ home: '', away: '' });
  const [correctionPhoto, setCorrectionPhoto] = useState<File | null>(null);
  const [startPhoto, setStartPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startPhotoPreview, setStartPhotoPreview] = useState<string | null>(null);
  const startPhotoId = useId();
  const correctionPhotoId = useId();
  const draftRestored = useRef(false);

  const load = async () => {
    const result = await getTournamentOperations();
    setData(result);
  };
  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, []);
  useEffect(() => {
    if (!data || draftRestored.current) return;
    draftRestored.current = true;
    void loadMatchStartDraft().then((draft) => {
      if (!draft) return;
      const slot = data.slots.find((candidate) => candidate.matchId === draft.matchId && candidate.match?.status === 'READY');
      if (!slot) {
        void clearMatchStartDraft();
        return;
      }
      setStarting(slot);
      setStartPhoto(draft.photo);
    });
  }, [data]);
  useEffect(() => {
    if (!startPhoto || typeof URL.createObjectURL !== 'function') { setStartPhotoPreview(null); return; }
    const preview = URL.createObjectURL(startPhoto);
    setStartPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [startPhoto]);

  const slots = useMemo(() => [...(data?.slots ?? [])].sort(byOperationPriority), [data]);

  const begin = (slot: TournamentScheduleSlot) => {
    const played = slot.match?.status === 'PLAYED';
    setEditing(slot); setScores({ home: played ? String(slot.match?.homeScore ?? '') : '', away: played ? String(slot.match?.awayScore ?? '') : '' }); setCorrectionPhoto(null); setError(null);
  };
  const beginStart = (slot: TournamentScheduleSlot) => {
    setStarting(slot); setStartPhoto(null); setError(null);
    if (slot.matchId) void saveMatchStartDraft(slot.matchId, null);
  };
  const selectStartPhoto = (photo: File | null) => {
    setStartPhoto(photo);
    if (starting?.matchId) void saveMatchStartDraft(starting.matchId, photo);
  };
  const closeStart = () => {
    if (busy) return;
    setStarting(null); setStartPhoto(null);
    void clearMatchStartDraft();
  };
  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!starting?.matchId || !startPhoto) return;
    setBusy(true); setError(null);
    try {
      await startMatch(starting.matchId, startPhoto);
      setStarting(null); setStartPhoto(null); await clearMatchStartDraft(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar el partido.'); }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing?.matchId || scores.home === '' || scores.away === '' || (editing.match?.status === 'PLAYED' && !editing.match.resultSourcePhotoAvailable && !correctionPhoto)) return;
    setBusy(true); setError(null);
    try {
      await saveMatchResult(editing.matchId, Number(scores.home), Number(scores.away), correctionPhoto ?? undefined);
      setEditing(null); setCorrectionPhoto(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el resultado.'); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="admin-panel inline-state">{error ?? 'Cargando partidos...'}</div>;
  const venueNames = [...new Set(data.courts.flatMap((court) => court.venue?.name ? [court.venue.name] : []))];
  return <div className="admin-panel court-results-page">
    <div className="panel-header"><div><p className="eyebrow">Operación de cancha</p><h1>Cargar resultados</h1><p>{data.tournament?.name ?? 'No hay un torneo activo.'}</p></div></div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    {!data.tournament ? <div className="inline-state">No hay un torneo activo.</div> : !data.courts.length ? <div className="inline-state">No tenés partidos en las sedes asignadas. Dirección debe asignarte desde Sedes.</div> : <>
      <section className="data-card result-court-selector"><div><span className="eyebrow">Sede asignada</span><h2>{venueNames.join(' / ') || 'Sede sin informar'}</h2></div><p className="field-hint">Todos los partidos de la sede · {slots.length} {slots.length === 1 ? 'partido' : 'partidos'}. La cancha programada se muestra solo como referencia.</p></section>
      <section className="data-card"><AdminDataGrid rows={slots} emptyMessage="No hay partidos programados en esta sede." columns={[
        { label: 'Horario', render: (slot) => slot.scheduledAt ? new Intl.DateTimeFormat('es-AR', { timeStyle: 'short', dateStyle: 'short' }).format(new Date(slot.scheduledAt)) : 'A definir' },
        { label: 'Partido', render: (slot) => <strong>P{slot.sequence} · {slot.tournamentCategory.category.name}</strong> },
        { label: 'Etapa', render: (slot) => slot.zoneName },
        { label: 'Local', render: (slot) => pairName(slot, 'home') },
        { label: 'Visitante', render: (slot) => pairName(slot, 'away') },
        { label: 'Cancha prevista', render: (slot) => slot.court ? `${slot.court.venue?.name ? `${slot.court.venue.name} · ` : ''}${slot.court.name}` : 'Sin asignar' },
        { label: 'Estado', render: (slot) => slot.match?.status === 'PLAYED' ? <strong>{slot.match.homeScore} - {slot.match.awayScore}</strong> : slot.match?.status === 'IN_PROGRESS' ? <span className="status-chip status-live"><span className="live-dot" />En juego</span> : slot.match?.status === 'READY' ? 'Listo para jugar' : 'A definir' },
      ]} renderActions={(slot) => <>{slot.match?.status === 'READY' && <button type="button" className="primary-button" disabled={busy} onClick={() => beginStart(slot)}>Iniciar partido</button>}{slot.match?.status === 'IN_PROGRESS' && <button type="button" className="primary-button" disabled={busy} onClick={() => begin(slot)}>Cargar resultado</button>}{slot.match?.status === 'PLAYED' && <button type="button" className="inline-link" disabled={busy} onClick={() => begin(slot)}>Editar resultado</button>}{slot.match?.resultPhotoAvailable && <button type="button" className="inline-link" onClick={() => void openMatchResultPhoto(slot.matchId!)}>Ver foto</button>}</>} /></section>
    </>}
    {starting?.match && <AdminDialog title={`Iniciar P${starting.sequence}`} className="result-start-dialog" onClose={closeStart}><form className="editor-form result-start-form" onSubmit={start}>
      {error && <div className="inline-state span-2" role="alert">{error}</div>}
      <p className="field-hint span-2">Esta foto marca el inicio del partido y se publica inmediatamente como “En juego”.</p>
      <div className="match-photo-orientation span-2"><div><span>Izquierda · Local</span><strong>{pairName(starting, 'home')}</strong></div><div><span>Derecha · Visitante</span><strong>{pairName(starting, 'away')}</strong></div></div>
      <div className="span-2 result-photo-field">
        <strong>Foto inicial del partido</strong>
        <input id={startPhotoId} className="camera-input" type="file" accept="image/*" capture="environment" onChange={(event) => selectStartPhoto(event.target.files?.[0] ?? null)} />
        <label className={`camera-button${startPhoto ? ' has-photo' : ''}`} htmlFor={startPhotoId}><span aria-hidden="true">📷</span>{startPhoto ? 'Volver a sacar la foto' : 'Sacar foto con la cámara'}</label>
        {startPhotoPreview && <img className="result-photo-preview" src={startPhotoPreview} alt="Vista previa de la foto inicial" />}
        {startPhoto && <span className="camera-photo-ready" role="status">Foto lista para publicar</span>}
        <small>Ubicá a la pareja local a la izquierda y a la visitante a la derecha. Al finalizar agregaremos automáticamente equipos, tantos y logo.</small>
      </div>
      <div className="span-2 form-actions"><button className="primary-button" disabled={busy || !startPhoto}>{busy ? 'Publicando...' : 'Publicar e iniciar partido'}</button></div>
    </form></AdminDialog>}
    {editing?.match && <AdminDialog title={`${editing.match.status === 'PLAYED' ? 'Editar resultado' : 'Resultado'} P${editing.sequence}`} onClose={() => { if (!busy) { setEditing(null); setCorrectionPhoto(null); } }}><form className="editor-form" onSubmit={save}>
      {error && <div className="inline-state span-2" role="alert">{error}</div>}
      <p className="field-hint span-2">{editing.tournamentCategory.category.name} · {editing.zoneName}</p>
      <label>{pairName(editing, 'home')}<input aria-label="Tantos local" type="number" min="0" max={editing.tournamentCategory.pointsPerSet} value={scores.home} onChange={(event) => setScores({ ...scores, home: event.target.value })} required /></label>
      <label>{pairName(editing, 'away')}<input aria-label="Tantos visitante" type="number" min="0" max={editing.tournamentCategory.pointsPerSet} value={scores.away} onChange={(event) => setScores({ ...scores, away: event.target.value })} required /></label>
      {editing.match.status === 'PLAYED' && <div className="span-2 result-photo-field"><strong>{editing.match.resultSourcePhotoAvailable ? 'Reemplazar foto original (opcional)' : 'Foto original sin la placa'}</strong><input id={correctionPhotoId} type="file" accept="image/*" onChange={(event) => setCorrectionPhoto(event.target.files?.[0] ?? null)} required={!editing.match.resultSourcePhotoAvailable} />{!editing.match.resultSourcePhotoAvailable && <small>Este resultado fue cargado antes de que el sistema conservara la foto inicial. Seleccionala nuevamente para poder regenerar la placa corregida.</small>}</div>}
      <p className="field-hint span-2">Uno de los dos equipos debe llegar a {editing.tournamentCategory.pointsPerSet} tantos.</p>
      <p className="field-hint span-2">Al confirmar, el sistema editará la foto inicial con los equipos, los tantos y el logo de Copa Leyendas.</p>
      <div className="span-2 form-actions"><button className="primary-button" disabled={busy || scores.home === '' || scores.away === '' || (editing.match.status === 'PLAYED' && !editing.match.resultSourcePhotoAvailable && !correctionPhoto)}>{busy ? 'Generando placa...' : editing.match.status === 'PLAYED' ? 'Guardar corrección' : 'Confirmar resultado'}</button></div>
    </form></AdminDialog>}
  </div>;
}
