import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataGrid, type AdminGridColumn } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { ProgramMap } from '../components/ProgramMap';
import { ProgramScenarioDialog } from '../components/ProgramScenarioDialog';
import { getCourts, getVenues, getTournamentScheduleGrid, getTournaments, updateTournamentScheduleSlot, redistributeTournamentCourts, saveMatchResult } from '../lib/api';
import type { Court, Venue, Tournament, TournamentScheduleSlot } from '../types';

type ProgramTab = 'matches' | 'venues' | 'categories' | 'map';
const bySchedule = (left: TournamentScheduleSlot, right: TournamentScheduleSlot) => (left.scheduledAt ?? '9999').localeCompare(right.scheduledAt ?? '9999') || left.sequence - right.sequence;
const matchLabel = (slot: TournamentScheduleSlot, allSlots: TournamentScheduleSlot[]) => {
  if (slot.match) {
    const match = slot.match;
    const participant = (side: 'home' | 'away') => {
      const pair = side === 'home' ? match.homeRegistration : match.awayRegistration;
      if (pair) return `${pair.playerOneName} / ${pair.playerTwoName} (${pair.localityName})`;
      const sourceId = side === 'home' ? match.homeSourceMatchId : match.awaySourceMatchId;
      const source = side === 'home' ? match.homeSource : match.awaySource;
      if (sourceId) return `${source === 'LOSER' ? 'Perdedora' : 'Ganadora'} P${allSlots.find((item) => item.matchId === sourceId)?.sequence ?? '?'}`;
      const qualifierZoneId = side === 'home' ? match.homeQualifierZoneId : match.awayQualifierZoneId;
      const rank = side === 'home' ? match.homeQualifierRank : match.awayQualifierRank;
      if (qualifierZoneId) return `${rank}.ª de ${allSlots.find((item) => item.match?.zoneId === qualifierZoneId)?.zoneName ?? 'zona a definir'}`;
      const zoneGames = allSlots.filter((item) => item.stage === 'ZONE' && item.match?.zoneId === match.zoneId);
      const positions = (zoneGames.length === 3 ? [[1, 2], [1, 3], [2, 3]] : [[1, 2], [3, 4]])[match.matchOrder - 1];
      return positions ? `Pareja ${positions[side === 'home' ? 0 : 1]} · A definir` : 'A definir';
    };
    return `${participant('home')} vs ${participant('away')}`;
  }
  if (slot.stage === 'QUARTERFINAL') return `Cuartos ${slot.matchOrder}`;
  if (slot.stage === 'SEMIFINAL') return `Semifinal ${slot.matchOrder}`;
  if (slot.stage === 'FINAL') return 'Final';
  if (slot.matchOrder < 3) return slot.matchOrder === 1 ? '1 vs 2' : '3 vs 4';
  const source = (order: number) => allSlots.find((candidate) => candidate.tournamentCategoryId === slot.tournamentCategoryId && candidate.zoneName === slot.zoneName && candidate.stage === 'ZONE' && candidate.matchOrder === order)?.sequence ?? '?';
  return slot.matchOrder === 3 ? `G Partido ${source(1)} vs P Partido ${source(2)}` : `G Partido ${source(2)} vs P Partido ${source(1)}`;
};

export function AdminProgramPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tournamentId, setTournamentId] = useState(0);
  const [slots, setSlots] = useState<TournamentScheduleSlot[]>([]);
  const [tab, setTab] = useState<ProgramTab>('matches');
  const [venueTab, setVenueTab] = useState('');
  const [courtTab, setCourtTab] = useState('all');
  const [categoryTab, setCategoryTab] = useState('');
  const [saving, setSaving] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ slot: TournamentScheduleSlot; kind: 'schedule' | 'result' } | null>(null);
  const [date, setDate] = useState('');
  const [editingCourt, setEditingCourt] = useState(0);
  const [scores, setScores] = useState({ home: 25, away: 0 });
  const editMatch = (slot: TournamentScheduleSlot, kind: 'schedule' | 'result') => {
    setError(null); setEditing({ slot, kind }); setScores({ home: slot.match?.homeScore ?? 25, away: slot.match?.awayScore ?? 0 }); setEditingCourt(slot.courtId ?? 0);
    setDate(slot.scheduledAt ? new Date(new Date(slot.scheduledAt).getTime() - new Date(slot.scheduledAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
  };
  const saveMatch = async (event: React.FormEvent) => {
    event.preventDefault(); if (!editing) return;
    setSaving(true); setError(null);
    try {
      if (editing.kind === 'result' && editing.slot.matchId) await saveMatchResult(editing.slot.matchId, scores.home, scores.away);
      else await updateTournamentScheduleSlot(editing.slot.id, { scheduledAt: date ? new Date(date).toISOString() : null, courtId: editingCourt || null });
      setSlots(await getTournamentScheduleGrid(tournamentId)); setEditing(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el partido.'); }
    finally { setSaving(false); }
  };
  const redistribute = async () => {
    setSaving(true); setError(null); setNotice(null);
    try {
      const items = await redistributeTournamentCourts(tournamentId);
      setSlots(items);
      const withoutDate = items.filter((slot) => !slot.scheduledAt).length;
      setNotice(`Programa actualizado y partidos repartidos entre las canchas activas. Se conservaron los horarios existentes.${withoutDate ? ` Quedaron ${withoutDate} partidos sin horario: revisá los días de juego y la disponibilidad de las sedes.` : ' Todos los partidos tienen horario.'}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron repartir los partidos.'); }
    finally { setSaving(false); }
  };
  useEffect(() => {
    Promise.all([getTournaments(), getCourts(), getVenues()]).then(([items, courtItems, venueItems]) => {
      setTournaments(items); setTournamentId(items[0]?.id ?? 0); setCourts(courtItems); setVenues(venueItems);
    }).catch((reason: Error) => setError(reason.message));
  }, []);
  useEffect(() => {
    let current = true;
    setSlots([]);
    setNotice(null);
    if (tournamentId) getTournamentScheduleGrid(tournamentId).then((items) => { if (current) setSlots(items); }).catch((reason: Error) => { if (current) setError(reason.message); });
    return () => { current = false; };
  }, [tournamentId]);
  const assignCourt = async (slot: TournamentScheduleSlot, courtId: number) => {
    setSaving(true); setError(null);
    try {
      await updateTournamentScheduleSlot(slot.id, { courtId: courtId || null });
      setSlots(await getTournamentScheduleGrid(tournamentId));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo asignar la cancha.'); }
    finally { setSaving(false); }
  };
  // Include empty courts and keep historical assignments visible if a court is deactivated.
  const knownCourts = [...new Map([...slots.flatMap((slot) => slot.court ? [slot.court] : []), ...courts].map((court) => [court.id, court])).values()];
  const visibleCourts = knownCourts.filter((court) => (court.active && court.venue?.active !== false) || slots.some((slot) => slot.courtId === court.id));
  const knownVenues = [...new Map([...knownCourts.flatMap((court) => court.venue ? [court.venue] : []), ...venues].map((venue) => [venue.id, venue])).values()];
  const venueOptions = knownVenues.filter((venue) => venue.active || visibleCourts.some((court) => court.venueId === venue.id)).sort((a, b) => a.name.localeCompare(b.name)).map((venue) => ({ id: String(venue.id), label: venue.name }));
  if (slots.some((slot) => !slot.court)) venueOptions.push({ id: 'unassigned', label: 'Sede a definir' });
  const selectedVenue = venueOptions.some((venue) => venue.id === venueTab) ? venueTab : venueOptions[0]?.id;
  const venueCourts = visibleCourts.filter((court) => String(court.venueId) === selectedVenue);
  const selectedCourt = courtTab === 'all' || venueCourts.some((court) => String(court.id) === courtTab) ? courtTab : 'all';
  const venueSlots = slots.filter((slot) => selectedVenue === 'unassigned' ? !slot.court : String(slot.court?.venueId) === selectedVenue);
  const courtOptions = [{ id: 'all', label: `Todas (${venueSlots.length})` }, ...venueCourts.map((court) => ({ id: String(court.id), label: `${court.name}${court.active ? '' : ' (inactiva)'} (${venueSlots.filter((slot) => slot.courtId === court.id).length})` }))];
  const columns: AdminGridColumn<TournamentScheduleSlot>[] = [
    { label: 'Partido', render: (slot) => slot.sequence },
    { label: 'Categoría', render: (slot) => slot.tournamentCategory.category.name },
    { label: 'Zona / Etapa', render: (slot) => slot.zoneName },
    { label: 'Cruce', render: (slot) => matchLabel(slot, slots) },
    { label: 'Resultado', render: (slot) => slot.match?.homeScore != null ? `${slot.match.homeScore} - ${slot.match.awayScore}` : slot.match?.status === 'READY' ? 'Listo para jugar' : 'Pendiente' },
    { label: 'Cancha / Sede', sortValue: (slot) => `${slot.court?.venue?.name ?? ''} ${slot.court?.name ?? ''}`, render: (slot) => <div className="program-court-picker">
      <select disabled={saving} aria-label={`Cancha para partido ${slot.sequence}`} value={slot.courtId ?? 0} onChange={(event) => void assignCourt(slot, Number(event.target.value))}>
        <option value="0">Sin asignar</option>
        {knownVenues.map((venue) => <optgroup key={venue.id} label={venue.name}>{knownCourts.filter((court) => court.venueId === venue.id && ((court.active && venue.active) || court.id === slot.courtId)).map((court) => <option key={court.id} value={court.id} disabled={!court.active || !venue.active}>{court.name}{court.active && venue.active ? '' : ' (inactiva)'}</option>)}</optgroup>)}
      </select>
      <small className="field-hint">{slot.court?.venue?.name ?? 'Sede a definir'}</small>
    </div> },
    { label: 'Horario', render: (slot) => slot.scheduledAt ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(slot.scheduledAt)) : 'A definir' },
    { label: 'Gestión', render: (slot) => <div className="list-actions">
      {slot.match?.zoneId && <Link to={`/app/zonas/${slot.match.zoneId}`}>Asignar parejas / ver zona</Link>}
      {slot.match?.status !== 'PLAYED' && <button type="button" className="inline-link" disabled={saving} onClick={() => editMatch(slot, 'schedule')}>Horario</button>}
      {slot.match?.status === 'READY' && <button type="button" className="inline-link" disabled={saving} onClick={() => editMatch(slot, 'result')}>Resultado</button>}
    </div> },
  ];
  const byCategory = slots.reduce<Record<string, Record<string, TournamentScheduleSlot[]>>>((groups, slot) => {
    const category = slot.tournamentCategory.category.name;
    (groups[category] ??= {}); (groups[category][slot.zoneName] ??= []).push(slot); return groups;
  }, {});
  const categoryOptions = Object.keys(byCategory).sort().map((name) => ({ id: name, label: name }));
  const selectedCategory = byCategory[categoryTab] ? categoryTab : categoryOptions[0]?.id;
  return <div className="admin-panel program-page">
    <div className="program-header"><h1>Programa</h1>
      <label>Torneo<select aria-label="Seleccionar torneo" disabled={saving} value={tournamentId} onChange={(event) => { setTournamentId(Number(event.target.value)); setVenueTab(''); setCourtTab('all'); setCategoryTab(''); }}><option value="0">Seleccionar torneo</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
      <details className="program-options"><summary>Opciones</summary><div>
        <Link className="secondary-button" to="/app/canchas/internas">Administrar canchas</Link>
        <button type="button" className="secondary-button" disabled={saving || !tournamentId} onClick={() => setScenarioOpen(true)}>Repartir entre canchas</button>
        <small>Configurá días, sedes y canchas, y probá los horarios antes de aplicar.</small>
        <button type="button" className="inline-link" disabled={saving || !tournamentId} onClick={() => void redistribute()}>{saving ? 'Guardando…' : 'Completar sin cambiar horarios'}</button>
      </div></details>
    </div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    {notice && <div className="inline-state" role="status">{notice}</div>}
    <div className="program-tabs" role="tablist" aria-label="Vistas del programa">{([{ id: 'matches', label: 'Partidos' }, { id: 'venues', label: 'Sedes' }, { id: 'categories', label: 'Categorías' }, { id: 'map', label: 'Mapa' }] as const).map((item) => <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? 'is-selected' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    {tab === 'map' && tournamentId > 0 && <ProgramMap key={`${tournamentId}-${mapRevision}`} tournamentId={tournamentId} slots={slots} venues={venues} busy={saving} onChanged={async () => setSlots(await getTournamentScheduleGrid(tournamentId))} onMatch={editMatch} />}
    {scenarioOpen && <ProgramScenarioDialog tournamentId={tournamentId} courts={courts} venues={venues} onClose={() => setScenarioOpen(false)} onApplied={(items) => { setSlots(items); setScenarioOpen(false); setMapRevision((value) => value + 1); setNotice('Escenario aplicado: sedes, canchas y horarios actualizados.'); }} />}
    {tab === 'matches' && <ProgramTable title="Todos los partidos" slots={[...slots].sort((a, b) => a.sequence - b.sequence)} columns={columns} />}
    {tab === 'venues' && <ProgramSubTabs options={venueOptions} selected={selectedVenue} onSelect={(id) => { setVenueTab(id); setCourtTab('all'); }} ariaLabel="Sedes del programa">
      {selectedVenue && <section className="data-card"><div className="panel-header"><div className="program-venue-heading"><h2>{venueOptions.find((venue) => venue.id === selectedVenue)?.label}</h2><VenueAssignments slots={venueSlots} /></div></div>
        <ProgramSubTabs options={courtOptions} selected={selectedCourt} onSelect={setCourtTab} ariaLabel="Canchas de la sede">
          {!venueCourts.length && selectedVenue !== 'unassigned' && <p className="field-hint">Esta sede no tiene canchas activas. Agregalas desde Administrar canchas.</p>}
          <AdminDataGrid rows={venueSlots.filter((slot) => selectedCourt === 'all' || String(slot.courtId) === selectedCourt).sort(bySchedule)} columns={columns} emptyMessage="No hay partidos asignados a esta cancha o sede." />
        </ProgramSubTabs>
      </section>}
    </ProgramSubTabs>}
    {tab === 'categories' && <ProgramSubTabs options={categoryOptions} selected={selectedCategory} onSelect={setCategoryTab} ariaLabel="Categorías del programa">{selectedCategory && <section className="data-card"><div className="panel-header"><h2>{selectedCategory}</h2></div>{Object.entries(byCategory[selectedCategory]).sort(([a], [b]) => a.localeCompare(b)).map(([section, sectionSlots]) => <div className="program-zone" key={section}><h3>{section}</h3><AdminDataGrid rows={[...sectionSlots].sort(bySchedule)} emptyMessage="No hay partidos previstos." columns={columns} /></div>)}</section>}</ProgramSubTabs>}
    {tournamentId > 0 && !slots.length && <div className="inline-state">Agregá categorías y zonas al torneo para generar el programa.</div>}
    {editing && <AdminDialog title={`${editing.kind === 'result' ? 'Resultado' : 'Horario'} P${editing.slot.sequence}`} onClose={() => { if (!saving) setEditing(null); }}><form className="editor-form" onSubmit={saveMatch}>
      {error && <div className="inline-state span-2" role="alert">{error}</div>}
      <p className="field-hint span-2">{editing.slot.tournamentCategory.category.name} · {editing.slot.zoneName}<br />{matchLabel(editing.slot, slots)}</p>
      {editing.kind === 'schedule' ? <><label>Fecha y hora<input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Cancha<select value={editingCourt} onChange={(event) => setEditingCourt(Number(event.target.value))}><option value="0">Sin asignar</option>{knownVenues.map((venue) => <optgroup key={venue.id} label={venue.name}>{knownCourts.filter((court) => court.venueId === venue.id && ((court.active && venue.active) || court.id === editingCourt)).map((court) => <option key={court.id} value={court.id} disabled={!court.active || !venue.active}>{court.name}{court.active && venue.active ? '' : ' (inactiva)'}</option>)}</optgroup>)}</select></label></> : <><label>Local<input type="number" min="0" value={scores.home} disabled={editing.slot.match?.status === 'PLAYED'} onChange={(event) => setScores({ ...scores, home: Number(event.target.value) })} required /></label><label>Visitante<input type="number" min="0" value={scores.away} disabled={editing.slot.match?.status === 'PLAYED'} onChange={(event) => setScores({ ...scores, away: Number(event.target.value) })} required /></label></>}
      {editing.slot.match?.status !== 'PLAYED' && <div className="span-2 form-actions"><button className="primary-button" disabled={saving}>Guardar</button>{editing.kind === 'schedule' && editing.slot.match?.status === 'READY' && <button type="button" className="secondary-button" disabled={saving} onClick={() => editMatch(editing.slot, 'result')}>Cargar resultado</button>}</div>}
    </form></AdminDialog>}
  </div>;
}

function ProgramTable({ title, slots, columns }: { title: string; slots: TournamentScheduleSlot[]; columns: AdminGridColumn<TournamentScheduleSlot>[] }) {
  return <section className="data-card"><div className="panel-header"><h2>{title}</h2></div><AdminDataGrid rows={slots} emptyMessage="No hay partidos previstos." columns={columns} /></section>;
}

function VenueAssignments({ slots }: { slots: TournamentScheduleSlot[] }) {
  const categories = new Map<number, { name: string; zones: Set<string>; stages: Set<string> }>();
  for (const slot of slots) {
    const category = categories.get(slot.tournamentCategoryId) ?? { name: slot.tournamentCategory.category.name, zones: new Set<string>(), stages: new Set<string>() };
    if (slot.stage === 'ZONE') category.zones.add(slot.zoneName.replace(/^zona\s+/i, '').trim());
    else category.stages.add(slot.stage);
    categories.set(slot.tournamentCategoryId, category);
  }
  if (!categories.size) return <p className="field-hint">Sin categorías ni zonas programadas en esta sede.</p>;
  const stageNames = [['QUARTERFINAL', 'Cuartos de final'], ['SEMIFINAL', 'Semifinales'], ['FINAL', 'Final']];
  return <dl className="program-venue-assignments" aria-label="Categorías y zonas de la sede">
    {[...categories].sort(([, a], [, b]) => a.name.localeCompare(b.name, 'es', { numeric: true })).map(([id, category]) => {
      const zones = [...category.zones].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
      const description = [zones.length ? `${zones.length === 1 ? 'Zona' : 'Zonas'} ${zones.join(', ')}` : '', ...stageNames.filter(([stage]) => category.stages.has(stage)).map(([, name]) => name)].filter(Boolean).join(' · ');
      return <div key={id}><dt>{category.name}</dt><dd>{description}</dd></div>;
    })}
  </dl>;
}
function ProgramSubTabs({ options, selected, onSelect, ariaLabel, children }: { options: { id: string; label: string }[]; selected: string | undefined; onSelect: (id: string) => void; ariaLabel: string; children: ReactNode }) {
  if (!options.length) return <div className="inline-state">No hay datos configurados todavía.</div>;
  return <><div className="program-subtabs" role="tablist" aria-label={ariaLabel}>{options.map(({ id, label }) => <button type="button" role="tab" aria-selected={selected === id} key={id} className={selected === id ? 'is-selected' : ''} onClick={() => onSelect(id)}>{label}</button>)}</div>{children}</>;
}
