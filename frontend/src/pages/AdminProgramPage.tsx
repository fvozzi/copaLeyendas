import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataGrid, type AdminGridColumn } from '../components/AdminDataGrid';
import { getCourts, getVenues, getTournamentScheduleGrid, getTournaments, updateTournamentScheduleSlot } from '../lib/api';
import type { Court, Venue, Tournament, TournamentScheduleSlot } from '../types';

type ProgramTab = 'matches' | 'venues' | 'categories';
const bySchedule = (left: TournamentScheduleSlot, right: TournamentScheduleSlot) => (left.scheduledAt ?? '9999').localeCompare(right.scheduledAt ?? '9999') || left.sequence - right.sequence;
const matchLabel = (slot: TournamentScheduleSlot, allSlots: TournamentScheduleSlot[]) => {
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
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([getTournaments(), getCourts(), getVenues()]).then(([items, courtItems, venueItems]) => {
      setTournaments(items); setTournamentId(items[0]?.id ?? 0); setCourts(courtItems); setVenues(venueItems);
    }).catch((reason: Error) => setError(reason.message));
  }, []);
  useEffect(() => {
    let current = true;
    setSlots([]);
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
    { label: 'Cancha / Sede', sortValue: (slot) => `${slot.court?.venue?.name ?? ''} ${slot.court?.name ?? ''}`, render: (slot) => <div className="program-court-picker">
      <select disabled={saving} aria-label={`Cancha para partido ${slot.sequence}`} value={slot.courtId ?? 0} onChange={(event) => void assignCourt(slot, Number(event.target.value))}>
        <option value="0">Sin asignar</option>
        {knownVenues.map((venue) => <optgroup key={venue.id} label={venue.name}>{knownCourts.filter((court) => court.venueId === venue.id && ((court.active && venue.active) || court.id === slot.courtId)).map((court) => <option key={court.id} value={court.id} disabled={!court.active || !venue.active}>{court.name}{court.active && venue.active ? '' : ' (inactiva)'}</option>)}</optgroup>)}
      </select>
      <small className="field-hint">{slot.court?.venue?.name ?? 'Sede a definir'}</small>
    </div> },
    { label: 'Horario', render: (slot) => slot.scheduledAt ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(slot.scheduledAt)) : 'A definir' },
  ];
  const byCategory = slots.reduce<Record<string, Record<string, TournamentScheduleSlot[]>>>((groups, slot) => {
    const category = slot.tournamentCategory.category.name;
    (groups[category] ??= {}); (groups[category][slot.zoneName] ??= []).push(slot); return groups;
  }, {});
  const categoryOptions = Object.keys(byCategory).sort().map((name) => ({ id: name, label: name }));
  const selectedCategory = byCategory[categoryTab] ? categoryTab : categoryOptions[0]?.id;
  return <div className="admin-panel">
    <div className="panel-header"><div><p className="eyebrow">Organización</p><h1>Programa</h1><p className="field-hint">Consultá los partidos por sede y cancha. Podés cambiar la cancha desde cualquier vista.</p></div><Link className="secondary-button" to="/app/canchas/internas">Administrar canchas</Link></div>
    <section className="data-card"><label>Seleccionar torneo<select disabled={saving} value={tournamentId} onChange={(event) => { setTournamentId(Number(event.target.value)); setVenueTab(''); setCourtTab('all'); setCategoryTab(''); }}><option value="0">Seleccionar torneo</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label></section>
    {error && <div className="inline-state" role="alert">{error}</div>}
    <div className="program-tabs" role="tablist" aria-label="Vistas del programa">{([{ id: 'matches', label: 'Partidos' }, { id: 'venues', label: 'Sedes' }, { id: 'categories', label: 'Categorías' }] as const).map((item) => <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? 'is-selected' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    {tab === 'matches' && <ProgramTable title="Todos los partidos" slots={[...slots].sort((a, b) => a.sequence - b.sequence)} columns={columns} />}
    {tab === 'venues' && <ProgramSubTabs options={venueOptions} selected={selectedVenue} onSelect={(id) => { setVenueTab(id); setCourtTab('all'); }} ariaLabel="Sedes del programa">
      {selectedVenue && <section className="data-card"><div className="panel-header"><h2>{venueOptions.find((venue) => venue.id === selectedVenue)?.label}</h2></div>
        <ProgramSubTabs options={courtOptions} selected={selectedCourt} onSelect={setCourtTab} ariaLabel="Canchas de la sede">
          {!venueCourts.length && selectedVenue !== 'unassigned' && <p className="field-hint">Esta sede no tiene canchas activas. Agregalas desde Administrar canchas.</p>}
          <AdminDataGrid rows={venueSlots.filter((slot) => selectedCourt === 'all' || String(slot.courtId) === selectedCourt).sort(bySchedule)} columns={columns} emptyMessage="No hay partidos asignados a esta cancha o sede." />
        </ProgramSubTabs>
      </section>}
    </ProgramSubTabs>}
    {tab === 'categories' && <ProgramSubTabs options={categoryOptions} selected={selectedCategory} onSelect={setCategoryTab} ariaLabel="Categorías del programa">{selectedCategory && <section className="data-card"><div className="panel-header"><h2>{selectedCategory}</h2></div>{Object.entries(byCategory[selectedCategory]).sort(([a], [b]) => a.localeCompare(b)).map(([section, sectionSlots]) => <div className="program-zone" key={section}><h3>{section}</h3><AdminDataGrid rows={[...sectionSlots].sort(bySchedule)} emptyMessage="No hay partidos previstos." columns={columns} /></div>)}</section>}</ProgramSubTabs>}
    {tournamentId > 0 && !slots.length && <div className="inline-state">Agregá categorías y zonas al torneo para generar el programa.</div>}
  </div>;
}

function ProgramTable({ title, slots, columns }: { title: string; slots: TournamentScheduleSlot[]; columns: AdminGridColumn<TournamentScheduleSlot>[] }) {
  return <section className="data-card"><div className="panel-header"><h2>{title}</h2></div><AdminDataGrid rows={slots} emptyMessage="No hay partidos previstos." columns={columns} /></section>;
}
function ProgramSubTabs({ options, selected, onSelect, ariaLabel, children }: { options: { id: string; label: string }[]; selected: string | undefined; onSelect: (id: string) => void; ariaLabel: string; children: ReactNode }) {
  if (!options.length) return <div className="inline-state">No hay datos configurados todavía.</div>;
  return <><div className="program-subtabs" role="tablist" aria-label={ariaLabel}>{options.map(({ id, label }) => <button type="button" role="tab" aria-selected={selected === id} key={id} className={selected === id ? 'is-selected' : ''} onClick={() => onSelect(id)}>{label}</button>)}</div>{children}</>;
}
