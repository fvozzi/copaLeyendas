import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProgramZoneEditor } from '../components/ProgramZoneEditor';
import { applyTournamentDistribution, getTournament, getTournamentDistribution, getTournamentScheduleGrid, getTournaments, getVenues, setTournamentAttendance, setTournamentDistributionLayout, setTournamentDistributionVenue } from '../lib/api';
import type { Tournament, TournamentDistribution, TournamentDistributionCategory, TournamentScheduleSlot, TournamentZone, Venue, ZoneMethodology } from '../types';

interface DistributionConfigurationDraft {
  capacities: number[];
  methodology: ZoneMethodology;
  qualifiersPerZone: number;
}

export function AdminDistributionPage() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState(0);
  const [distribution, setDistribution] = useState<TournamentDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [updatingAttendance, setUpdatingAttendance] = useState<number | null>(null);
  const [updatingVenue, setUpdatingVenue] = useState<string | null>(null);
  const [updatingLayout, setUpdatingLayout] = useState<number | null>(null);
  const [configurationDrafts, setConfigurationDrafts] = useState<Record<number, DistributionConfigurationDraft>>({});
  const [error, setError] = useState<string | null>(null);
  const [zoneEditor, setZoneEditor] = useState<{ zone: TournamentZone; venues: Venue[]; slots: TournamentScheduleSlot[] } | null>(null);

  useEffect(() => {
    getTournaments().then((items) => {
      setTournaments(items);
      setTournamentId(items.find((item) => item.status === 'ACTIVE')?.id ?? items[0]?.id ?? 0);
    }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  const calculate = async (id = tournamentId) => {
    if (!id) return;
    setLoading(true); setError(null);
    try { setDistribution(await getTournamentDistribution(id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo calcular el armado de zonas.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tournamentId) void calculate(tournamentId); }, [tournamentId]);
  useEffect(() => {
    if (!distribution) return;
    setConfigurationDrafts(Object.fromEntries(distribution.plans.map((plan) => [plan.tournamentCategoryId, {
      capacities: [...plan.capacities], methodology: plan.methodology ?? 'PROVINCE', qualifiersPerZone: plan.qualifiersPerZone ?? 2,
    }])));
  }, [distribution]);

  const apply = async (resetProgram = false) => {
    if (!distribution?.canApply || applying) return;
    const newConfirmedCount = distribution.plans.reduce((sum, plan) => sum + plan.newRegistrationCount, 0);
    const message = resetProgram
      ? 'Se reconstruirán desde cero los partidos, sedes, canchas y horarios del Programa. Se perderán los ajustes manuales pendientes. ¿Continuar?'
      : distribution.replacesPendingFixture
      ? newConfirmedCount
        ? `Se incorporarán ${newConfirmedCount} ${newConfirmedCount === 1 ? 'pareja confirmada nueva' : 'parejas confirmadas nuevas'}, conservando al máximo las zonas actuales y la programación de los partidos equivalentes. ¿Continuar?`
        : 'Se rearmarán las zonas conservando, cuando el partido siga existiendo, la sede, cancha y horario definidos en Programa. ¿Continuar?'
      : 'Se crearán las zonas, las asignaciones y el fixture real del torneo. ¿Continuar?';
    if (!window.confirm(message)) return;
    setApplying(true); setError(null);
    try { setDistribution(await applyTournamentDistribution(tournamentId, distribution.baseVersion, resetProgram)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo aplicar el armado de zonas.'); }
    finally { setApplying(false); }
  };

  const changeAttendance = async (registrationId: number, present: boolean) => {
    if (updatingAttendance) return;
    setUpdatingAttendance(registrationId); setError(null);
    try { setDistribution(await setTournamentAttendance(tournamentId, registrationId, present)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la asistencia.'); }
    finally { setUpdatingAttendance(null); }
  };

  const changeVenue = async (tournamentCategoryId: number, zoneIndex: number, venueId: number) => {
    const key = `${tournamentCategoryId}-${zoneIndex}`;
    if (updatingVenue) return;
    setUpdatingVenue(key); setError(null);
    try { setDistribution(await setTournamentDistributionVenue(tournamentId, tournamentCategoryId, zoneIndex, venueId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la sede de la zona.'); }
    finally { setUpdatingVenue(null); }
  };

  const saveLayout = async (tournamentCategoryId: number, capacities: number[] | null, methodology: ZoneMethodology, qualifiersPerZone: number) => {
    if (updatingLayout) return;
    setUpdatingLayout(tournamentCategoryId); setError(null);
    try { setDistribution(await setTournamentDistributionLayout(tournamentId, tournamentCategoryId, capacities, methodology, qualifiersPerZone)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la configuración de zonas.'); }
    finally { setUpdatingLayout(null); }
  };

  const openZoneEditor = async (zoneId: number) => {
    setLoading(true); setError(null);
    try {
      const [detail, venues, slots] = await Promise.all([getTournament(tournamentId), getVenues(), getTournamentScheduleGrid(tournamentId)]);
      const zone = detail.zones.find((item) => item.id === zoneId);
      if (!zone) throw new Error('La zona ya no existe. Recalculá el armado de zonas.');
      setZoneEditor({ zone, venues, slots: slots.filter((slot) => slot.match?.zoneId === zoneId) });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir la zona.'); }
    finally { setLoading(false); }
  };

  const refreshZoneEditor = async () => {
    if (!zoneEditor) return;
    const [nextDistribution, detail, slots] = await Promise.all([getTournamentDistribution(tournamentId), getTournament(tournamentId), getTournamentScheduleGrid(tournamentId)]);
    setDistribution(nextDistribution);
    const zone = detail.zones.find((item) => item.id === zoneEditor.zone.id);
    if (!zone) { setZoneEditor(null); return; }
    setZoneEditor({ ...zoneEditor, zone, slots: slots.filter((slot) => slot.match?.zoneId === zone.id) });
  };

  return <div className="admin-panel distribution-page">
    <div className="panel-header">
      <div><p className="eyebrow">Competencia</p><h1>Armado de zonas</h1></div>
      <Link className="secondary-button" to="/app/programa">Ir a Programación</Link>
    </div>
    <section className="data-card distribution-rules">
      <div><h2>Asignación de parejas a zonas</h2><p>Definí la sede de cada zona y revisá cómo quedan agrupadas las parejas. Los partidos se crean recién al aplicar la vista previa.</p></div>
      <ol>{(distribution?.rules ?? [
        'Dirección puede configurar hasta cuatro zonas de 3 o 4 parejas.',
        'Se pueden reservar lugares para futuras parejas confirmadas.',
        'Sin una configuración manual, el sistema calcula el esquema automáticamente.',
        'Las parejas de la misma localidad comparten sede, pero no zona.',
      ]).map((rule) => <li key={rule}>{rule}</li>)}</ol>
    </section>
    <div className="distribution-toolbar">
      <label>Torneo<select value={tournamentId} onChange={(event) => setTournamentId(Number(event.target.value))}><option value="0">Seleccionar</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
      <button type="button" className="secondary-button" disabled={!tournamentId || loading} onClick={() => void calculate()}>{loading ? 'Calculando...' : 'Recalcular vista previa'}</button>
      {distribution?.mode === 'PREVIEW' && <button type="button" className="primary-button" disabled={!distribution.canApply || applying} onClick={() => void apply(false)}>{applying ? 'Generando...' : distribution.replacesPendingFixture ? distribution.plans.some((plan) => plan.newRegistrationCount > 0) ? 'Sumar nuevas confirmadas' : 'Aplicar conservando programación' : 'Aplicar y generar partidos'}</button>}
      {distribution?.mode === 'PREVIEW' && distribution.replacesPendingFixture && <button type="button" className="danger-link" disabled={!distribution.canApply || applying} onClick={() => void apply(true)}>Rehacer programación desde cero</button>}
    </div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    {distribution?.mode === 'PREVIEW' && distribution.replacesPendingFixture && <div className="inline-state">{distribution.plans.some((plan) => plan.newRegistrationCount > 0) ? 'Hay nuevas parejas confirmadas. Al sumarlas se conservan tantas asignaciones de zona como sea posible' : 'La asistencia o las zonas cambiaron'} y se mantienen las sedes, canchas y horarios editados en Programación para los partidos equivalentes. Usá “Rehacer programación desde cero” sólo si querés descartarlos.</div>}
    {distribution?.mode === 'CURRENT' && <div className="inline-state inline-state-success">El armado de zonas ya está aplicado: hay {distribution.matchCount} partidos reales. Cualquier cambio hecho desde Programación modifica estos mismos partidos.</div>}
    {distribution?.mode === 'PREVIEW' && !distribution.canApply && !loading && <div className="inline-state">La vista previa no se puede aplicar todavía. Revisá las observaciones y que exista al menos una sede activa.</div>}
    <div className="distribution-category-grid">
      {distribution?.plans.map((plan) => <article className="data-card distribution-category" key={plan.tournamentCategoryId}>
        <header><div><p className="eyebrow">{plan.registrationCount} parejas confirmadas{plan.newRegistrationCount > 0 ? ` · ${plan.newRegistrationCount} ${plan.newRegistrationCount === 1 ? 'nueva' : 'nuevas'}` : ''}</p><h2>{plan.categoryName}</h2></div><div className="distribution-summary"><strong>{plan.capacities.length ? plan.capacities.join(' + ') : 'Sin zonas'}</strong><span>{plan.venue?.name ?? (plan.zones.some((zone) => zone.venue) ? 'Varias sedes' : 'Sin sede asignada')}</span></div></header>
        {!distribution.hasResults && <DistributionLayoutEditor
          plan={plan}
          draft={configurationDrafts[plan.tournamentCategoryId] ?? { capacities: plan.capacities, methodology: plan.methodology ?? 'PROVINCE', qualifiersPerZone: plan.qualifiersPerZone ?? 2 }}
          disabled={updatingLayout !== null || applying}
          onChange={(draft) => setConfigurationDrafts((current) => ({ ...current, [plan.tournamentCategoryId]: draft }))}
          onSave={(draft) => void saveLayout(plan.tournamentCategoryId, draft.capacities, draft.methodology, draft.qualifiersPerZone)}
          onAutomatic={(draft) => void saveLayout(plan.tournamentCategoryId, null, draft.methodology, draft.qualifiersPerZone)}
        />}
        <div className="distribution-attendance">
          {distribution.attendance.filter((registration) => registration.tournamentCategoryId === plan.tournamentCategoryId).map((registration) => <div key={registration.id} className={registration.present ? '' : 'is-absent'}>
            <span><strong>{registration.label}</strong><small>{registration.localityName}</small></span>
            <button type="button" className={registration.present ? 'danger-link' : 'inline-link'} disabled={updatingAttendance === registration.id || distribution.hasResults} onClick={() => void changeAttendance(registration.id, !registration.present)}>{updatingAttendance === registration.id ? 'Guardando...' : registration.present ? 'Marcar ausente' : 'Volver a incluir'}</button>
          </div>)}
        </div>
        {plan.warnings.map((warning) => <p className="distribution-warning" key={warning}>{warning}</p>)}
        <div className="distribution-zone-grid">{plan.zones.map((zone, zoneIndex) => <section className="distribution-zone" key={`${plan.tournamentCategoryId}-${zone.name}`}>
          <div><h3>{zone.name}</h3><span>{zone.registrations.length}/{zone.capacity} parejas</span>{distribution.mode === 'PREVIEW' ? <label>Sede<select aria-label={`Sede de ${plan.categoryName} ${zone.name}`} value={zone.venue?.id ?? 0} disabled={updatingVenue !== null || distribution.hasResults} onChange={(event) => void changeVenue(plan.tournamentCategoryId, zoneIndex, Number(event.target.value))}><option value={0} disabled>Seleccionar sede</option>{(distribution.venues ?? []).map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select><small>{updatingVenue === `${plan.tournamentCategoryId}-${zoneIndex}` ? 'Guardando…' : zone.venueAssignment === 'MANUAL' ? 'Asignación de Dirección' : 'Pendiente de Dirección'}</small></label> : <span>{zone.venue?.name ?? plan.venue?.name}</span>}{zone.id && <button type="button" className="inline-link" onClick={() => void openZoneEditor(zone.id!)}>Editar zona y parejas</button>}</div>
          <ol>{zone.registrations.map((registration) => <li key={registration.id}><strong>{registration.label}</strong><small>{registration.localityName}</small></li>)}</ol>
        </section>)}</div>
      </article>)}
    </div>
    {!loading && distribution && !distribution.plans.length && <p className="empty-copy">El torneo todavía no tiene categorías configuradas.</p>}
    {zoneEditor && <ProgramZoneEditor zone={zoneEditor.zone} venues={zoneEditor.venues} slots={zoneEditor.slots} onClose={() => setZoneEditor(null)} onChanged={refreshZoneEditor} onMatch={() => navigate('/app/programa')} />}
  </div>;
}

function DistributionLayoutEditor({ plan, draft, disabled, onChange, onSave, onAutomatic }: {
  plan: TournamentDistributionCategory;
  draft: DistributionConfigurationDraft;
  disabled: boolean;
  onChange: (draft: DistributionConfigurationDraft) => void;
  onSave: (draft: DistributionConfigurationDraft) => void;
  onAutomatic: (draft: DistributionConfigurationDraft) => void;
}) {
  const { capacities, methodology, qualifiersPerZone } = draft;
  const places = capacities.reduce((sum, capacity) => sum + capacity, 0);
  const available = places - plan.registrationCount;
  const qualified = capacities.length * qualifiersPerZone;
  const nextStage = qualified === 8 ? 'Cuartos de final' : qualified === 4 ? 'Semifinales' : qualified === 2 ? 'Final' : null;
  const matchCount = capacities.reduce((sum, capacity) => sum + (methodology === 'PROVINCE' ? capacity : capacity * (capacity - 1) / 2), 0);
  const dirty = JSON.stringify(capacities) !== JSON.stringify(plan.capacities) || methodology !== plan.methodology || qualifiersPerZone !== plan.qualifiersPerZone;
  const change = (changes: Partial<DistributionConfigurationDraft>) => onChange({ ...draft, ...changes });
  const update = (index: number, capacity: number) => change({ capacities: capacities.map((current, currentIndex) => currentIndex === index ? capacity : current) });
  return <section className="distribution-layout" aria-label={`Configuración de zonas de ${plan.categoryName}`}>
    <header><div><h3>Formato de competencia</h3><p>Definí zonas, metodología de juego y cuántas parejas avanzan por zona.</p></div><span className={plan.layoutMode === 'MANUAL' ? 'is-manual' : ''}>{plan.layoutMode === 'MANUAL' ? 'Definido por Dirección' : 'Cálculo automático'}</span></header>
    <div className="distribution-methodology">
      <label>Metodología<select aria-label={`Metodología de ${plan.categoryName}`} value={methodology} disabled={disabled} onChange={(event) => change({ methodology: event.target.value as ZoneMethodology })}><option value="PROVINCE">Metodología Provincia</option><option value="ROUND_ROBIN">Todos contra todas</option></select></label>
      <label>Clasifican por zona<select aria-label={`Clasificadas por zona de ${plan.categoryName}`} value={qualifiersPerZone} disabled={disabled} onChange={(event) => change({ qualifiersPerZone: Number(event.target.value) })}><option value={1}>Primera</option><option value={2}>Primera y segunda</option></select></label>
      <div className={nextStage ? 'distribution-next-stage' : 'distribution-next-stage is-invalid'}><span>Siguiente etapa</span><strong>{nextStage ?? 'Sin cuadro directo'}</strong><small>{qualified} {qualified === 1 ? 'pareja clasificada' : 'parejas clasificadas'} en total</small></div>
    </div>
    <p className="distribution-methodology-copy">{methodology === 'PROVINCE'
      ? 'Provincia: cada pareja juega 2 partidos. En zonas de 4 se cruzan 1–3 y 2–4; luego ganadoras contra perdedoras. En zonas de 3 se juega 1–2 y la Pareja 3 enfrenta a la ganadora y a la perdedora.'
      : 'Todos contra todas: cada pareja enfrenta una vez a todas las demás de su zona. Se aplica igual en todas las zonas de esta categoría.'}</p>
    <div className="distribution-layout-zones">{capacities.map((capacity, index) => <div key={index}>
      <label>Zona {String.fromCharCode(65 + index)}<select aria-label={`Capacidad de ${plan.categoryName} Zona ${String.fromCharCode(65 + index)}`} value={capacity} disabled={disabled} onChange={(event) => update(index, Number(event.target.value))}><option value={3}>3 parejas</option><option value={4}>4 parejas</option></select></label>
      <button type="button" className="danger-link" aria-label={`Quitar Zona ${String.fromCharCode(65 + index)} de ${plan.categoryName}`} disabled={disabled || capacities.length === 1} onClick={() => change({ capacities: capacities.filter((_, currentIndex) => currentIndex !== index) })}>Quitar</button>
    </div>)}</div>
    <div className="distribution-layout-footer"><button type="button" className="secondary-button" disabled={disabled || capacities.length >= 4} onClick={() => change({ capacities: [...capacities, 3] })}>Agregar zona</button><p className={available < 0 || !nextStage ? 'distribution-layout-error' : ''}><strong>{places} lugares</strong> para {plan.registrationCount} confirmadas{available > 0 ? ` · ${available} ${available === 1 ? 'libre' : 'libres'}` : available < 0 ? ` · faltan ${Math.abs(available)}` : ' · completo'}<br />{matchCount} partidos de zona · {nextStage ? `${nextStage} como segunda etapa` : 'ajustá zonas o clasificadas para formar un cuadro de 2, 4 u 8'}</p><div className="list-actions"><button type="button" className="primary-button" disabled={disabled || available < 0 || !nextStage || (plan.layoutMode === 'MANUAL' && !dirty)} onClick={() => onSave(draft)}>{plan.layoutMode === 'MANUAL' ? 'Guardar configuración' : 'Fijar configuración'}</button>{plan.layoutMode === 'MANUAL' && <button type="button" className="inline-link" disabled={disabled} onClick={() => onAutomatic(draft)}>Volver a automático</button>}</div></div>
  </section>;
}
