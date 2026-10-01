import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { getActivity } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ActivityLogPage } from '../types';

const empty: ActivityLogPage = { items: [], total: 0, page: 1, pageSize: 50, pages: 1 };
const dateTime = (value: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
const methodLabels: Record<string, string> = { GET: 'Consulta', POST: 'Alta / acción', PATCH: 'Edición', PUT: 'Edición', DELETE: 'Eliminación' };

export function AdminActivityPage() {
  const { user } = useAuth();
  const director = user?.role === 'DIRECTOR';
  const [data, setData] = useState<ActivityLogPage>(empty);
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await getActivity({ page, pageSize: 50, search: search || undefined, level: level || undefined, method: method || undefined })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cargar la actividad.'); }
    finally { setLoading(false); }
  }, [page, search, level, method]);
  useEffect(() => { if (director) void load(); }, [director, load]);

  if (!director) return <Navigate to="/app" replace />;
  return <div className="admin-panel activity-page">
    <div className="panel-header"><div><p className="eyebrow">Administración</p><h1>Actividad</h1></div><button className="secondary-button" disabled={loading} onClick={() => void load()}>{loading ? 'Actualizando…' : 'Actualizar'}</button></div>
    <p>Historial de operaciones y errores. No guarda el contenido de formularios, contraseñas, DNI, teléfonos ni archivos.</p>
    <form className="toolbar activity-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(draftSearch.trim()); }}>
      <input aria-label="Buscar actividad" placeholder="Buscar por evento, usuario, ruta o código" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} />
      <select aria-label="Filtrar por resultado" value={level} onChange={(event) => { setPage(1); setLevel(event.target.value); }}><option value="">Todos los resultados</option><option value="INFO">Correctos</option><option value="WARNING">Advertencias</option><option value="ERROR">Errores</option></select>
      <select aria-label="Filtrar por operación" value={method} onChange={(event) => { setPage(1); setMethod(event.target.value); }}><option value="">Todas las operaciones</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button className="secondary-button">Buscar</button>
    </form>
    {error ? <div className="inline-state" role="alert">{error}</div> : null}
    <section className="data-card">
      <div className="registrations-section-heading"><h2>Eventos</h2><p>{data.total} registros</p></div>
      <AdminDataGrid rows={data.items} emptyMessage={loading ? 'Cargando actividad…' : 'No hay actividad para estos filtros.'} columns={[
        { label: 'Fecha', render: (item) => <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time>, sortValue: (item) => new Date(item.createdAt).getTime() },
        { label: 'Evento', render: (item) => <><strong>{item.message}</strong><small className="admin-grid-detail">{item.method} {item.path}</small>{item.detail ? <small className="activity-error-detail">{item.detail}</small> : null}</> },
        { label: 'Usuario', render: (item) => item.actorName ?? (item.source === 'PUBLIC' ? 'Sitio público' : 'Administrador') },
        { label: 'Resultado', render: (item) => <><span className={`status-chip ${item.level === 'INFO' ? 'status-live' : item.level === 'ERROR' ? 'status-draft' : 'status-review'}`}>{item.statusCode}</span><small className="admin-grid-detail">{item.durationMs} ms</small></> },
        { label: 'Código', render: (item) => <code title={item.requestId}>{item.requestId.slice(0, 8)}</code> },
      ]} />
      <div className="activity-pagination"><button type="button" className="secondary-button" disabled={data.page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {data.page} de {data.pages}</span><button type="button" className="secondary-button" disabled={data.page >= data.pages || loading} onClick={() => setPage((current) => current + 1)}>Siguiente</button></div>
    </section>
  </div>;
}
