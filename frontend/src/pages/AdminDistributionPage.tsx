import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyTournamentDistribution, getTournamentDistribution, getTournaments } from '../lib/api';
import type { Tournament, TournamentDistribution } from '../types';

export function AdminDistributionPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState(0);
  const [distribution, setDistribution] = useState<TournamentDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo calcular la distribución.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tournamentId) void calculate(tournamentId); }, [tournamentId]);

  const apply = async () => {
    if (!distribution?.canApply || applying) return;
    if (!window.confirm('Se crearán las zonas, las asignaciones y el fixture real del torneo. ¿Continuar?')) return;
    setApplying(true); setError(null);
    try { setDistribution(await applyTournamentDistribution(tournamentId, distribution.baseVersion)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo aplicar la distribución.'); }
    finally { setApplying(false); }
  };

  return <div className="admin-panel distribution-page">
    <div className="panel-header">
      <div><p className="eyebrow">Competencia</p><h1>Distribución</h1></div>
      <Link className="secondary-button" to="/app/programa">Programa / Mapa</Link>
    </div>
    <section className="data-card distribution-rules">
      <div><h2>Reglas automáticas</h2><p>La vista previa no modifica el torneo. Al aplicarla se crean las zonas y los partidos reales.</p></div>
      <ol>{(distribution?.rules ?? [
        'Si la cantidad es divisible por 3, se crean zonas de 3.',
        'Si no es divisible por 3 pero sí por 4, se crean zonas de 4.',
        'En los demás casos se combinan zonas de 3 y 4 sin dejar lugares vacíos.',
        'Las parejas de la misma localidad comparten sede, pero no zona.',
      ]).map((rule) => <li key={rule}>{rule}</li>)}</ol>
    </section>
    <div className="distribution-toolbar">
      <label>Torneo<select value={tournamentId} onChange={(event) => setTournamentId(Number(event.target.value))}><option value="0">Seleccionar</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
      <button type="button" className="secondary-button" disabled={!tournamentId || loading} onClick={() => void calculate()}>{loading ? 'Calculando...' : 'Recalcular vista previa'}</button>
      {distribution?.mode === 'PREVIEW' && <button type="button" className="primary-button" disabled={!distribution.canApply || applying} onClick={() => void apply()}>{applying ? 'Generando...' : 'Aplicar y generar partidos'}</button>}
    </div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    {distribution?.mode === 'CURRENT' && <div className="inline-state inline-state-success">La distribución ya está aplicada: hay {distribution.matchCount} partidos reales. Cualquier cambio hecho desde Programa / Mapa modifica estos mismos partidos.</div>}
    {distribution?.mode === 'PREVIEW' && !distribution.canApply && !loading && <div className="inline-state">La vista previa no se puede aplicar todavía. Revisá las observaciones y que exista al menos una sede activa.</div>}
    <div className="distribution-category-grid">
      {distribution?.plans.map((plan) => <article className="data-card distribution-category" key={plan.tournamentCategoryId}>
        <header><div><p className="eyebrow">{plan.registrationCount} parejas</p><h2>{plan.categoryName}</h2></div><div className="distribution-summary"><strong>{plan.capacities.length ? plan.capacities.join(' + ') : 'Sin zonas'}</strong><span>{plan.venue?.name ?? (plan.zones.some((zone) => zone.venue) ? 'Varias sedes' : 'Sin sede asignada')}</span></div></header>
        {plan.warnings.map((warning) => <p className="distribution-warning" key={warning}>{warning}</p>)}
        <div className="distribution-zone-grid">{plan.zones.map((zone) => <section className="distribution-zone" key={`${plan.tournamentCategoryId}-${zone.name}`}>
          <div><h3>{zone.name}</h3><span>{zone.registrations.length}/{zone.capacity} · {zone.venue?.name ?? plan.venue?.name}</span>{zone.id && <Link className="inline-link" to={`/app/zonas/${zone.id}`}>Abrir partidos</Link>}</div>
          <ol>{zone.registrations.map((registration) => <li key={registration.id}><strong>{registration.label}</strong><small>{registration.localityName}</small></li>)}</ol>
        </section>)}</div>
      </article>)}
    </div>
    {!loading && distribution && !distribution.plans.length && <p className="empty-copy">El torneo todavía no tiene categorías configuradas.</p>}
  </div>;
}
