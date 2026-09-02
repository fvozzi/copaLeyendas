import { useEffect, useState } from 'react';
import { getDashboardSummary } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  accessGrantStatusLabels,
  categoryLabels,
  registrationStatusLabels,
  sectionMeta,
} from '../lib/content';
import type { DashboardSummary } from '../types';

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'DIRECTOR') return;
    getDashboardSummary()
      .then(setSummary)
      .catch((reason: Error) => setError(reason.message));
  }, [user?.role]);

  if (user?.role !== 'DIRECTOR') {
    return <div className="admin-panel"><div className="panel-header"><div><p className="eyebrow">Operacion de cancha</p><h1>Partidos asignados</h1><p>Ingresa a Torneos y abre una zona de tu cancha para actualizar horarios y resultados.</p></div></div></div>;
  }

  if (error) {
    return <div className="admin-panel inline-state">{error}</div>;
  }

  if (!summary) {
    return <div className="admin-panel inline-state">Cargando resumen...</div>;
  }

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

      <div className="admin-grid">
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
        <section className="data-card">
          <h2>Inscripciones por categoria</h2>
          <ul className="data-list">
            {Object.entries(categoryLabels).map(([key, value]) => (
              <li key={key}>
                <span>{value}</span>
                <strong>{summary.registrations.byCategory[key] ?? 0}</strong>
              </li>
            ))}
          </ul>
        </section>
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
      </div>
    </div>
  );
}
