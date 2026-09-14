import { useEffect, useState } from 'react';
import { AdminDialog } from './AdminDialog';
import { applyProgramScenario, getTournament, getTournamentScheduleGrid, previewProgramScenario } from '../lib/api';
import type { Court, ProgramScenario, ProgramScenarioPreview, ProgramScenarioRule, TournamentDetail, TournamentScheduleSlot, Venue } from '../types';

const stageNames = { ZONE: 'Partidos de zona', QUARTERFINAL: 'Cuartos de final', SEMIFINAL: 'Semifinales', FINAL: 'Final' };
const dayOf = (value?: string | null) => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value)) : '';
const timeOf = (value?: string | null) => value ? new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : 'Sin horario';
const keyOf = (rule: ProgramScenarioRule) => `${rule.categoryId}-${rule.stage}-${rule.stage === 'ZONE' ? rule.zoneId : rule.matchOrder ?? ''}`;

export function ProgramScenarioDialog({ tournamentId, courts, venues, onClose, onApplied }: {
  tournamentId: number; courts: Court[]; venues: Venue[]; onClose: () => void; onApplied: (slots: TournamentScheduleSlot[]) => void;
}) {
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [config, setConfig] = useState<ProgramScenario | null>(null);
  const [preview, setPreview] = useState<ProgramScenarioPreview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState(0), [venueFilter, setVenueFilter] = useState(0);
  const [step, setStep] = useState<'config' | 'preview'>('config');
  useEffect(() => {
    let current = true;
    // Refresh so categories added in another view are included when opening the dialog.
    Promise.all([getTournament(tournamentId), getTournamentScheduleGrid(tournamentId)]).then(([data, slots]) => {
      if (!current) return;
      const days = [...(data.playingDays ?? [])].sort();
      const mainDay = days[0] || data.startsAt || dayOf(slots.find((slot) => slot.scheduledAt)?.scheduledAt) || '';
      const finalsDay = days[days.length - 1] || data.endsAt || mainDay;
      const rules: ProgramScenarioRule[] = [];
      for (const category of data.categories) {
        const zones = data.zones.filter((zone) => zone.tournamentCategoryId === category.id).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        for (const zone of zones) {
          const games = slots.filter((slot) => slot.match?.zoneId === zone.id);
          const ids = [...new Set(games.map((slot) => slot.courtId).filter(Boolean))];
          const courtId = ids.length === 1 && courts.find((court) => court.id === ids[0])?.venueId === zone.venueId ? ids[0] : null;
          rules.push({ categoryId: category.id, stage: 'ZONE', zoneId: zone.id, venueId: zone.venueId, courtId, day: finalsDay !== mainDay && games.length > 0 && games.every((game) => dayOf(game.scheduledAt) === finalsDay) ? 'FINALS' : 'MAIN' });
        }
        for (const stage of ['QUARTERFINAL', 'SEMIFINAL', 'FINAL'] as const) {
          const games = slots.filter((slot) => slot.tournamentCategoryId === category.id && slot.stage === stage);
          if (!games.length && zones.length < 4) continue;
          const count = stage === 'QUARTERFINAL' ? 4 : stage === 'SEMIFINAL' ? 2 : 1;
          for (let matchOrder = 1; matchOrder <= count; matchOrder++) {
            const game = games.find((slot) => slot.matchOrder === matchOrder);
            const venueId = game?.court?.venueId ?? zones[0]?.venueId ?? venues.find((venue) => venue.active)?.id ?? 0;
            const recordedDay = dayOf(game?.scheduledAt);
            rules.push({ categoryId: category.id, stage, matchOrder, venueId, courtId: game?.courtId ?? null, day: recordedDay ? finalsDay !== mainDay && recordedDay === finalsDay ? 'FINALS' : 'MAIN' : stage === 'QUARTERFINAL' ? 'MAIN' : 'FINALS' });
          }
        }
      }
      setDetail(data); setConfig({ mainDay, finalsDay, interleaveCategories: false, rules });
    }).catch((reason: Error) => { if (current) setError(reason.message); });
    return () => { current = false; };
  }, [tournamentId]);
  const change = (next: ProgramScenario) => { setConfig(next); setPreview(null); setError(null); };
  const changeRule = (key: string, patch: Partial<ProgramScenarioRule>) => { if (config) change({ ...config, rules: config.rules.map((rule) => keyOf(rule) === key ? { ...rule, ...patch } : rule) }); };
  const calculate = async () => {
    if (!config) return;
    setBusy(true); setError(null);
    try { setPreview(await previewProgramScenario(tournamentId, config)); setStep('preview'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo calcular el escenario.'); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!config || !preview || preview.warnings.length) return;
    setBusy(true); setError(null);
    try { const result = await applyProgramScenario(tournamentId, { ...config, baseVersion: preview.baseVersion }); onApplied(result.slots); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo aplicar el escenario.'); setPreview(null); setStep('config'); }
    finally { setBusy(false); }
  };
  const categoryName = (id: number) => detail?.categories.find((category) => category.id === id)?.category.name ?? '';
  const visibleRules = config?.rules.filter((rule) => (!categoryFilter || rule.categoryId === categoryFilter) && (!venueFilter || rule.venueId === venueFilter)) ?? [];
  return <AdminDialog title="Repartir partidos" className="scenario-dialog" onClose={() => { if (!busy) onClose(); }}><div className="program-scenario">
    {error && <div className="inline-state" role="alert">{error}</div>}
    {!config || !detail ? !error && <p>Cargando categorías, zonas y canchas…</p> : <>
      <p className="field-hint">Probá distintos escenarios. La vista previa no cambia los horarios; al aplicar se guardan las canchas, las sedes de las zonas y los nuevos horarios.</p>
      <div className="scenario-steps"><button className={step === 'config' ? 'is-selected' : ''} disabled={busy} onClick={() => setStep('config')}>1. Configuración</button><button className={step === 'preview' ? 'is-selected' : ''} disabled={!preview || busy} onClick={() => setStep('preview')}>2. Vista previa</button></div>
      {step === 'config' ? <>
        <div className="scenario-days"><label>Día principal<input type="date" value={config.mainDay} disabled={busy} onChange={(event) => change({ ...config, mainDay: event.target.value })} /></label><label>Día de finales<input type="date" min={config.mainDay} value={config.finalsDay} disabled={busy} onChange={(event) => change({ ...config, finalsDay: event.target.value })} /></label></div>
        <label className="scenario-interleave"><input type="checkbox" checked={config.interleaveCategories} disabled={busy} onChange={(event) => change({ ...config, interleaveCategories: event.target.checked })} />Intercalar partidos por categoría en cada sede</label>
        <p className="field-hint">Se respetan los cruces previos, la duración y los turnos diarios configurados en cada sede. Podés pasar cualquier etapa al día de finales.</p>
        <div className="scenario-filters"><label>Categoría<select aria-label="Categoría del escenario" value={categoryFilter} onChange={(event) => setCategoryFilter(Number(event.target.value))}><option value={0}>Todas</option>{detail.categories.map((category) => <option key={category.id} value={category.id}>{category.category.name}</option>)}</select></label><label>Sede<select aria-label="Sede del escenario" value={venueFilter} onChange={(event) => setVenueFilter(Number(event.target.value))}><option value={0}>Todas</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label></div>
        <p className="field-hint">Los filtros solo cambian lo que ves. Se calcula el torneo completo.</p>
        {Object.entries(stageNames).map(([stage, title]) => <section key={stage} className="scenario-stage"><h3>{title}</h3>
          {!visibleRules.some((rule) => rule.stage === stage) && <p className="field-hint">No hay partidos para estos filtros.</p>}
          {visibleRules.filter((rule) => rule.stage === stage).map((rule) => {
            const key = keyOf(rule), zone = detail.zones.find((zone) => zone.id === rule.zoneId);
            const label = `${categoryName(rule.categoryId)} · ${zone ? `Zona ${zone.name}` : `${title}${rule.stage === 'FINAL' ? '' : ` ${rule.matchOrder}`}`}`;
            return <div className="scenario-rule" key={key}><strong>{categoryName(rule.categoryId)}<small>{zone ? `Zona ${zone.name} · ${zone.capacity} parejas` : `${title}${rule.stage === 'FINAL' ? '' : ` ${rule.matchOrder}`}`}</small></strong>
              <label>Día<select aria-label={`Día: ${label}`} disabled={busy} value={rule.day} onChange={(event) => changeRule(key, { day: event.target.value as ProgramScenarioRule['day'] })}><option value="MAIN">Principal</option><option value="FINALS">Finales</option></select></label>
              <label>Sede<select aria-label={`Sede: ${label}`} disabled={busy} value={rule.venueId} onChange={(event) => changeRule(key, { venueId: Number(event.target.value), courtId: null })}><option value={0}>Seleccionar sede</option>{venues.filter((venue) => venue.active || venue.id === rule.venueId).map((venue) => <option key={venue.id} value={venue.id} disabled={!venue.active}>{venue.name}</option>)}</select></label>
              <label>Cancha<select aria-label={`Cancha: ${label}`} disabled={busy} value={rule.courtId ?? 0} onChange={(event) => changeRule(key, { courtId: Number(event.target.value) || null })}><option value={0}>Todas · repartir</option>{courts.filter((court) => court.venueId === rule.venueId && (court.active || court.id === rule.courtId)).map((court) => <option key={court.id} value={court.id} disabled={!court.active}>{court.name}</option>)}</select></label>
            </div>;
          })}
        </section>)}
      </> : preview && <>
        <div className="scenario-preview-summary" role="status"><strong>{preview.slots.length} partidos</strong><span>{preview.slots.length - preview.warnings.length} con horario</span><span>{preview.warnings.length} sin horario</span></div>
        {preview.warnings.length > 0 && <div className="inline-state" role="alert">Hay partidos que no entran. Cambiá los días o las canchas para poder aplicar el escenario.<ul>{preview.warnings.map((warning) => <li key={warning.sequence}>P{warning.sequence}: {warning.message}</li>)}</ul></div>}
        <PreviewSchedule slots={preview.slots} />
      </>}
      <div className="scenario-footer">{step === 'preview' && <button className="secondary-button" disabled={busy} onClick={() => setStep('config')}>Ajustar escenario</button>}<button className="secondary-button" disabled={busy || !config.mainDay || !config.finalsDay || !config.rules.length} onClick={() => void calculate()}>{busy ? 'Procesando…' : preview ? 'Recalcular' : 'Calcular vista previa'}</button>{preview && step === 'preview' && <button className="primary-button" disabled={busy || preview.warnings.length > 0} onClick={() => void apply()}>Aplicar escenario</button>}</div>
    </>}
  </div></AdminDialog>;
}

function PreviewSchedule({ slots }: { slots: TournamentScheduleSlot[] }) {
  const groups = new Map<string, TournamentScheduleSlot[]>();
  for (const slot of [...slots].sort((a, b) => (a.scheduledAt ?? '9999').localeCompare(b.scheduledAt ?? '9999') || a.sequence - b.sequence)) {
    const key = `${dayOf(slot.scheduledAt) || 'Sin fecha'} · ${slot.court?.venue?.name ?? 'Sin cancha'}`;
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  return <div className="scenario-preview">{[...groups].map(([key, games]) => <section className="scenario-stage" key={key}><h3>{key}</h3><p className="field-hint">{games.length} partidos · Desde {timeOf(games[0].scheduledAt)} hasta {games[games.length - 1].scheduledAt ? timeOf(new Date(new Date(games[games.length - 1].scheduledAt!).getTime() + (games[games.length - 1].court?.venue?.matchDurationMinutes ?? 40) * 60_000).toISOString()) : 'sin definir'}</p><details><summary>Ver partidos y canchas</summary>{games.map((slot) => <div className="scenario-preview-game" key={slot.id}><strong>{timeOf(slot.scheduledAt)}</strong><span>{slot.court?.name ?? 'Sin cancha'}</span><span>P{slot.sequence} · {slot.tournamentCategory.category.name}<small>{slot.stage === 'ZONE' ? `Zona ${slot.zoneName}` : stageNames[slot.stage]} · Partido {slot.matchOrder}</small></span></div>)}</details></section>)}</div>;
}
