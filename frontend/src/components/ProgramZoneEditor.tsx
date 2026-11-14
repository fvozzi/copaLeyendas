import { useEffect, useState } from 'react';
import { AdminDialog } from './AdminDialog';
import { assignZonePlace, getZone, getZoneRegistrationPlacements, updateTournamentZone } from '../lib/api';
import type { PairRegistration, TournamentScheduleSlot, TournamentZone, Venue, ZoneDetail, ZoneRegistrationPlacement } from '../types';

const registrationLabel = (pair: PairRegistration) => `${pair.locality.name} · ${pair.playerOneName} / ${pair.playerTwoName}`;
const placementKey = (placement: Pick<ZoneRegistrationPlacement, 'registrationId' | 'localityId'>) => `${placement.registrationId ?? 'new'}:${placement.localityId}`;
const placementPairLabel = (placement: ZoneRegistrationPlacement) => `${placement.locality.name} · ${placement.playerOneName} / ${placement.playerTwoName}`;

export function ProgramZoneEditor({ zone, venues, slots, onClose, onChanged, onMatch }: {
  zone: TournamentZone; venues: Venue[]; slots: TournamentScheduleSlot[]; onClose: () => void; onChanged: () => Promise<void>;
  onMatch: (slot: TournamentScheduleSlot, kind: 'schedule' | 'result') => void;
}) {
  const [detail, setDetail] = useState<ZoneDetail | null>(null);
  const [placements, setPlacements] = useState<ZoneRegistrationPlacement[]>([]);
  const [name, setName] = useState(zone.name);
  const [venueId, setVenueId] = useState(zone.venueId);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    const [data, choices] = await Promise.all([getZone(zone.id), getZoneRegistrationPlacements(zone.tournamentCategoryId)]);
    setDetail(data); setPlacements(choices); setSelected({});
  };
  useEffect(() => { let current = true;
    Promise.all([getZone(zone.id), getZoneRegistrationPlacements(zone.tournamentCategoryId)]).then(([data, choices]) => { if (current) { setDetail(data); setPlacements(choices); } }).catch((reason: Error) => { if (current) setError(reason.message); });
    return () => { current = false; };
  }, [zone.id, zone.tournamentCategoryId]);
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); await onChanged(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el cambio.'); }
    finally { setBusy(false); }
  };
  const played = slots.some((slot) => slot.match?.status === 'PLAYED');
  const placementLabel = (placement: ZoneRegistrationPlacement) => `${placementPairLabel(placement)}${placement.zoneId ? ` — ${placement.zoneName}, Pareja ${placement.seed}` : ' — Sin zona'}`;
  return <AdminDialog title={`Zona ${zone.name.replace(/^zona\s+/i, '')} · ${zone.tournamentCategory.category.name}`} onClose={() => { if (!busy) onClose(); }}>
    {error && <div className="inline-state" role="alert">{error}</div>}
    <form className="editor-form" onSubmit={(event) => { event.preventDefault(); void run(() => updateTournamentZone(zone.id, { name, venueId, capacity: zone.capacity })); }}>
      <label>Nombre de zona<input value={name} disabled={busy} onChange={(event) => setName(event.target.value)} required /></label>
      <label>Sede de la zona<select value={venueId} disabled={busy} onChange={(event) => setVenueId(Number(event.target.value))}>{venues.filter((venue) => venue.active || venue.id === venueId).map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
      <small className="field-hint span-2">Cambiar la sede traslada los partidos pendientes, conservando sus horarios.</small>
      <div className="form-actions span-2"><button className="primary-button" disabled={busy || !venueId}>{busy ? 'Guardando…' : 'Guardar zona'}</button></div>
    </form>
    <h3>Parejas de la zona</h3>
    {played && <p className="field-hint">Las parejas ya tienen resultados y no se pueden reemplazar.</p>}
    {!played && <p className="field-hint">Podés elegir cualquier equipo activo de la categoría, esté en otra sede, otra zona o todavía sin zona. Si ambos lugares están ocupados, las parejas intercambian posiciones y los partidos pendientes se actualizan automáticamente.</p>}
    {!detail ? <p>Cargando parejas…</p> : <div className="map-zone-places">{Array.from({ length: zone.capacity }, (_, index) => {
      const seed = index + 1;
      const entry = detail.entries.find((item) => item.seed === seed);
      const currentKey = entry ? `${entry.registration.id}:${entry.registration.localityId}` : '0';
      const selectedPlacement = placements.find((placement) => placementKey(placement) === selected[seed]);
      const fromAnotherZone = Boolean(selectedPlacement?.zoneId && selectedPlacement.zoneId !== zone.id);
      const exchange = fromAnotherZone && Boolean(entry);
      return <div key={seed}><label>Pareja {seed}<select aria-label={`Pareja ${seed} de zona ${zone.name}`} disabled={busy || played} value={selected[seed] ?? currentKey} onChange={(event) => setSelected((current) => ({ ...current, [seed]: event.target.value }))}>
        <option value="0">A definir</option>{entry && <option value={currentKey}>{registrationLabel(entry.registration)} — Actual</option>}{placements.filter((placement) => placementKey(placement) !== currentKey && (placement.zoneId !== zone.id || (placement.registrationId === entry?.registration.id && placement.localityId !== entry.registration.localityId))).map((placement) => <option key={placementKey(placement)} value={placementKey(placement)}>{placementLabel(placement)}</option>)}
      </select></label><button className="secondary-button" disabled={busy || played || !selectedPlacement || selected[seed] === currentKey} onClick={() => {
        if (fromAnotherZone && !window.confirm(entry
          ? `¿Intercambiar ${placementPairLabel(selectedPlacement!)} (${selectedPlacement!.zoneName}, Pareja ${selectedPlacement!.seed}) con ${registrationLabel(entry.registration)} (${zone.name}, Pareja ${seed})? Los partidos pendientes de ambas zonas se actualizarán.`
          : `¿Mover ${placementPairLabel(selectedPlacement!)} desde ${selectedPlacement!.zoneName}, Pareja ${selectedPlacement!.seed}, al lugar libre ${zone.name}, Pareja ${seed}? Los partidos pendientes de ambas zonas se actualizarán.`)) return;
        if (!selectedPlacement) return;
        void run(() => assignZonePlace(zone.id, seed, { registrationId: selectedPlacement.registrationId, localityId: selectedPlacement.localityId }));
      }}>{exchange ? 'Intercambiar' : fromAnotherZone ? 'Mover' : entry ? 'Reemplazar' : 'Asignar'}</button></div>;
    })}</div>}
    <h3>Partidos</h3>
    <div className="map-zone-games">{slots.map((slot) => <div key={slot.id}><strong>P{slot.sequence}</strong><span>{slot.court?.name ?? 'Sin cancha'} · {slot.scheduledAt ? new Date(slot.scheduledAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin horario'}</span>
      {slot.match?.status === 'PLAYED' ? <strong>{slot.match.homeScore}–{slot.match.awayScore}</strong> : <button className="inline-link" disabled={busy} onClick={() => onMatch(slot, 'schedule')}>Editar partido</button>}
      {slot.match?.status === 'READY' && <button className="inline-link" disabled={busy} onClick={() => onMatch(slot, 'result')}>Resultado</button>}
    </div>)}</div>
  </AdminDialog>;
}
