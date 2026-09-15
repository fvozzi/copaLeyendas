import { useState } from 'react';
import type { Court, ProgramMatchOverride, ProgramScenario, ProgramScenarioPreview, TournamentScheduleSlot, Venue } from '../types';

const stages = { ZONE: 'Zona', QUARTERFINAL: 'Cuartos', SEMIFINAL: 'Semifinal', FINAL: 'Final' };
const datePart = (value: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value));
const timePart = (value: string) => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value));

export function ProgramScenarioPreviewTable({ preview, config, courts, venues, busy, onOverride, onEditing }: {
  preview: ProgramScenarioPreview; config: ProgramScenario; courts: Court[]; venues: Venue[]; busy: boolean;
  onOverride: (sequence: number, value: ProgramMatchOverride | null) => void;
  onEditing: (editing: boolean) => void;
}) {
  const [onlyPending, setOnlyPending] = useState(preview.warnings.length > 0);
  const [onlyCapacity, setOnlyCapacity] = useState(false);
  const [search, setSearch] = useState('');
  const [editingSequence, setEditingSequence] = useState<number | null>(null);
  const closeEditor = () => { setEditingSequence(null); onEditing(false); };
  const slots = [...preview.slots].sort((a, b) => Number(Boolean(a.scheduledAt)) - Number(Boolean(b.scheduledAt)) || (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '') || a.sequence - b.sequence);
  const shown = slots.filter((slot) => (!onlyPending || preview.warnings.some((w) => w.sequence === slot.sequence)) && (!onlyCapacity || preview.capacityWarnings?.some((w) => w.sequence === slot.sequence)) && (!search.trim() || `P${slot.sequence} ${slot.tournamentCategory.category.name} ${slot.zoneName}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const summaries = new Map<string, { count: number; first: string; end: string }>();
  for (const slot of preview.slots) if (slot.scheduledAt && slot.court?.venue) {
    const key = `${datePart(slot.scheduledAt)} · ${slot.court.venue.name}`;
    const end = new Date(new Date(slot.scheduledAt).getTime() + (slot.court.venue.matchDurationMinutes ?? 40) * 60_000).toISOString();
    const summary = summaries.get(key) ?? { count: 0, first: slot.scheduledAt, end };
    summary.count++; if (slot.scheduledAt < summary.first) summary.first = slot.scheduledAt; if (end > summary.end) summary.end = end;
    summaries.set(key, summary);
  }
  return <div className="scenario-preview">
    {!!summaries.size && <details className="scenario-stage"><summary>Resumen de horarios por sede</summary>{[...summaries].sort(([a], [b]) => a.localeCompare(b)).map(([key, summary]) => <p key={key} className="field-hint">{key}: {summary.count} partidos · {timePart(summary.first)} a {timePart(summary.end)}</p>)}</details>}
    <div className="scenario-match-filters"><label className="scenario-interleave"><input type="checkbox" checked={onlyPending} onChange={(event) => { closeEditor(); setOnlyPending(event.target.checked); if (event.target.checked) setOnlyCapacity(false); }} />Solo partidos pendientes ({preview.warnings.length})</label><label>Buscar partido o categoría<input type="search" value={search} onChange={(event) => { closeEditor(); setSearch(event.target.value); }} placeholder="Ej. P65 o Núcleo A" /></label></div>
    {!!preview.capacityWarnings?.length && <label className="scenario-interleave"><input type="checkbox" checked={onlyCapacity} onChange={(event) => { closeEditor(); setOnlyCapacity(event.target.checked); if (event.target.checked) setOnlyPending(false); }} />Solo fuera de lo previsto ({preview.capacityWarnings.length})</label>}
    <p className="field-hint">Los horarios manuales quedan fijos al recalcular. Pueden estar fuera de los turnos automáticos; se validan los cruces previos y las superposiciones.</p>
    {!shown.length && <p>No hay partidos para estos filtros.</p>}
    {shown.map((slot) => {
      const rule = config.rules.find((r) => r.categoryId === slot.tournamentCategoryId && r.stage === slot.stage && (r.stage === 'ZONE' ? r.zoneId === slot.match?.zoneId : r.matchOrder === slot.matchOrder)) ?? config.rules.find((r) => r.categoryId === slot.tournamentCategoryId && r.stage === slot.stage && !r.zoneId && !r.matchOrder);
      const override = config.overrides?.find((o) => o.sequence === slot.sequence);
      const venueId = courts.find((c) => c.id === override?.courtId)?.venueId ?? rule?.venueId;
      const venue = venues.find((v) => v.id === venueId);
      const day = override ? datePart(override.scheduledAt) : rule?.day === 'FINALS' ? config.finalsDay : config.mainDay;
      return <ScenarioMatchRow key={slot.sequence} slot={slot} override={override} venue={venue} day={day} plannedCourtId={override?.courtId ?? rule?.courtId ?? null} courts={courts} busy={busy} capacityWarning={preview.capacityWarnings?.find((w) => w.sequence === slot.sequence)?.message} warning={preview.warnings.find((w) => w.sequence === slot.sequence)?.message} onOverride={(sequence, value) => { closeEditor(); onOverride(sequence, value); }} editing={editingSequence === slot.sequence} onToggle={() => { const next = editingSequence === slot.sequence ? null : slot.sequence; setEditingSequence(next); onEditing(next !== null); }} />;
    })}
  </div>;
}

function ScenarioMatchRow({ slot, override, venue, day, plannedCourtId, courts, busy, warning, capacityWarning, onOverride, editing, onToggle }: {
  slot: TournamentScheduleSlot; override?: ProgramMatchOverride; venue?: Venue; day: string; plannedCourtId: number | null; courts: Court[]; busy: boolean; warning?: string;
  onOverride: (sequence: number, value: ProgramMatchOverride | null) => void;
  editing: boolean; onToggle: () => void;
  capacityWarning?: string;
}) {
  const existingDate = override?.scheduledAt ?? slot.scheduledAt;
  const [date, setDate] = useState(existingDate ? `${datePart(existingDate)}T${timePart(existingDate)}` : `${day}T${venue?.startsAt?.slice(0, 5) ?? '10:00'}`);
  const [courtId, setCourtId] = useState(override?.courtId ?? slot.courtId ?? plannedCourtId ?? courts.find((c) => c.active && c.venue?.active && c.venueId === venue?.id)?.id ?? 0);
  const knownVenues = [...new Map(courts.flatMap((c) => c.active && c.venue?.active ? [[c.venueId, c.venue] as const] : [])).values()];
  const plannedCourt = courts.find((c) => c.id === plannedCourtId);
  const caption = slot.stage === 'ZONE' ? `Zona ${slot.zoneName} · Partido ${slot.matchOrder}` : `${stages[slot.stage]} ${slot.matchOrder}`;
  return <section className={`scenario-match-row${warning ? ' has-warning' : capacityWarning ? ' over-capacity' : ''}`} id={`scenario-match-${slot.sequence}`}>
    <div className="scenario-preview-game"><strong>P{slot.sequence}<small>{override ? 'Manual' : 'Automático'}</small></strong><span>{slot.scheduledAt ? `${datePart(slot.scheduledAt)} · ${timePart(slot.scheduledAt)}` : 'Sin horario válido'}<small>{slot.court ? `${slot.court.venue?.name} · ${slot.court.name}` : `${venue?.name ?? 'Sede sin configurar'} · ${plannedCourt?.name ?? 'Repartir entre canchas'}`}</small></span><span>{slot.tournamentCategory.category.name}<small>{caption}</small></span><button type="button" className="secondary-button" disabled={busy} onClick={onToggle}>{editing ? 'Cerrar edición' : 'Editar horario'}</button></div>
    {!slot.scheduledAt && <p className="field-hint">Previsto: {day} · {venue?.name ?? 'Sede sin configurar'} · {plannedCourt?.name ?? 'Todas las canchas activas'}</p>}
    {warning && <p className="scenario-match-warning">{warning}</p>}
    {capacityWarning && <p className="scenario-capacity-message">{capacityWarning}</p>}
    {editing && <form className="scenario-match-editor" onSubmit={(event) => { event.preventDefault(); onOverride(slot.sequence, { sequence: slot.sequence, courtId, scheduledAt: new Date(`${date}:00-03:00`).toISOString() }); }}>
      <label>Fecha y hora de P{slot.sequence}<input type="datetime-local" required disabled={busy} value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>Cancha de P{slot.sequence}<select required disabled={busy} value={courtId || ''} onChange={(event) => setCourtId(Number(event.target.value))}><option value="">Seleccionar cancha</option>{knownVenues.map((v) => <optgroup key={v.id} label={v.name}>{courts.filter((c) => c.active && c.venueId === v.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select></label>
      <div className="form-actions"><button className="primary-button" disabled={busy || !courtId || !date}>Recalcular con este horario</button>{override && <button type="button" className="secondary-button" disabled={busy} onClick={() => onOverride(slot.sequence, null)}>Volver a automático</button>}</div>
    </form>}
  </section>;
}
