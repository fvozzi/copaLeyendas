import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { ShirtDistribution } from '../components/ShirtDistribution';
import { getDashboardSummary } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  accessGrantStatusLabels,
  registrationStatusLabels,
  sectionMeta,
} from '../lib/content';
import type { DashboardSummary, RegistrationStatus } from '../types';

const categoryStatusColumns: { status: RegistrationStatus; short: string }[] = [
  { status: 'RECEIVED', short: 'REC' },
  { status: 'UNDER_REVIEW', short: 'REV' },
  { status: 'CONFIRMED', short: 'CONF' },
  { status: 'WAITLIST', short: 'ESP' },
  { status: 'REJECTED', short: 'RECH' },
];

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'DIRECTOR') return;
    let active = true;
    const load = () => getDashboardSummary()
      .then((value) => { if (active) { setSummary(value); setError(null); } })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    void load();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [user?.role]);

  if (user?.role !== 'DIRECTOR') {
    return <div className="admin-panel"><div className="panel-header"><div><p className="eyebrow">Operación de cancha</p><h1>Partidos asignados</h1><p>Elegí tu cancha y cargá cada resultado junto con su foto.</p></div><Link className="primary-button" to="/app/resultados">Cargar resultados</Link></div></div>;
  }

  if (error) {
    return <div className="admin-panel inline-state">{error}</div>;
  }

  if (!summary) {
    return <div className="admin-panel inline-state">Cargando resumen...</div>;
  }

  const matchesByVenue = summary.matchesByVenue ?? { tournamentName: null, venues: [], totalMatches: 0 };
  const categoryNames = [...new Set([...Object.keys(summary.accessGrants.byCategory), ...Object.keys(summary.registrations.byCategory)])];

  return (
    <div className="admin-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Resumen operativo</p>
          <h1>Estado del sitio y la convocatoria</h1>
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Publicaciones</p>
          <strong>{summary.posts.total}</strong>
          <span>{summary.posts.published} publicadas</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">Destacadas</p>
          <strong>{summary.posts.featured}</strong>
          <span>Notas priorizadas en home</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">Inscripciones</p>
          <strong>{summary.registrations.total}</strong>
          <span>Parejas recibidas</span>
        </article>
        <article className="stat-card">
          <p className="stat-label">Tokens emitidos</p>
          <strong>{summary.accessGrants.total}</strong>
          <span>Habilitaciones por localidad</span>
        </article>
      </div>

      <div className="dashboard-overview-grid">
        <section className="data-card">
          <div className="panel-header"><div><h2>Partidos por sede</h2><p className="field-hint">{matchesByVenue.tournamentName ?? 'No hay torneo activo.'}</p></div><strong>Total: {matchesByVenue.totalMatches}</strong></div>
          <AdminDataGrid rows={matchesByVenue.venues.map((venue, index) => ({ ...venue, id: index + 1 }))} emptyMessage="No hay zonas configuradas para el torneo activo." columns={[{ label: 'Sede', render: (venue) => <strong>{venue.venue}</strong> }, { label: 'Categorias', render: (venue) => venue.categories.join(', ') }, { label: 'Partidos', render: (venue) => venue.matches }]} />
        </section>
        <section className="data-card">
          <h2>Habilitaciones e inscripciones por categoria</h2>
          <p className="field-hint">Cupo de referencia: 16 parejas por categoría.</p>
          <div className="category-summary-wrap">
            <table className="category-summary-table" aria-label="Inscripciones por categoría">
              <thead><tr><th scope="col">Categoría</th><th scope="col" title="Total de inscripciones" aria-label="Total de inscripciones">TOT</th>{categoryStatusColumns.map(({ status, short }) => <th key={status} scope="col" title={registrationStatusLabels[status]} aria-label={registrationStatusLabels[status]}>{short}</th>)}</tr></thead>
              <tbody>{categoryNames.map((name) => {
                const statuses = summary.registrations.byCategoryAndStatus?.[name] ?? {} as Record<RegistrationStatus, number>;
                return <tr key={name}>
                  <th scope="row">{name}</th>
                  <td><strong>{summary.accessGrants.byCategory[name] ?? 0}</strong></td>
                  {categoryStatusColumns.map(({ status }) => <td key={status}>{status === 'CONFIRMED' ? <CategoryCount count={statuses[status] ?? 0} /> : <strong>{statuses[status] ?? 0}</strong>}</td>)}
                </tr>;
              })}</tbody>
            </table>
          </div>
          <p className="field-hint">TOT: habilitaciones emitidas, incluidos los tokens aún no usados. REC: recibidas. REV: en revisión. CONF: confirmadas. ESP: lista de espera. RECH: rechazadas.</p>
          <Link to="/app/inscripciones" className="inline-link">Ver inscripciones</Link>
        </section>
      </div>

      <div className="admin-grid">
        <ShirtDistribution distribution={summary.registrations.shirtDistribution} />
        <section className="data-card">
          <h2>Estado de seguimiento</h2>
          <ul className="data-list">
            {Object.entries(registrationStatusLabels).map(([key, value]) => (
              <li key={key}>
                <span>{value}</span>
                <strong>{summary.registrations.byStatus[key] ?? 0}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="data-card">
          <h2>Estado de tokens</h2>
          <ul className="data-list">
            {Object.entries(accessGrantStatusLabels).map(([key, value]) => (
              <li key={key}>
                <span>{value}</span>
                <strong>{summary.accessGrants.byStatus[key] ?? 0}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="data-card">
          <h2>Publicaciones por seccion</h2>
          <ul className="data-list">
            {Object.entries(sectionMeta).map(([key, value]) => (
              <li key={key}>
                <span>{value.label}</span>
                <strong>{summary.posts.bySection[key] ?? 0}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function CategoryCount({ count }: { count: number }) {
  return <span className={`category-count${count > 16 ? ' category-count-over' : count === 16 ? ' category-count-full' : ''}`}>
    <strong>{count}</strong>
    {count >= 16 ? <small>{count > 16 ? `Excede por ${count - 16}` : 'Cupo completo'}</small> : null}
  </span>;
}
