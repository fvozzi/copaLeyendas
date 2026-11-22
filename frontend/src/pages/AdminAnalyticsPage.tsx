import { useEffect, useMemo, useState } from 'react';
import { getAnalyticsSummary } from '../lib/api';
import type { AnalyticsSummary } from '../types';

const deviceLabels: Record<string, string> = { MOBILE: 'Celular', TABLET: 'Tablet', DESKTOP: 'Computadora' };

export function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSummary(null); setError(null);
    void getAnalyticsSummary(days)
      .then((value) => { if (active) setSummary(value); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [days]);

  const maxDailyViews = useMemo(() => Math.max(1, ...(summary?.daily.map((item) => item.views) ?? [])), [summary]);

  return <div className="admin-panel analytics-page">
    <div className="panel-header"><div><p className="eyebrow">Uso del sitio público</p><h1>Estadísticas de visitas</h1><p>Medición anónima, sin almacenar direcciones IP ni datos personales.</p></div><label className="analytics-period">Período<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option></select></label></div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    {!summary && !error ? <div className="inline-state">Cargando estadísticas...</div> : summary && <>
      <div className="stats-grid analytics-stats">
        <article className="stat-card"><p className="stat-label">Visitas</p><strong>{summary.views}</strong><span>Páginas vistas</span></article>
        <article className="stat-card"><p className="stat-label">Visitantes</p><strong>{summary.visitors}</strong><span>Navegadores aproximados</span></article>
        <article className="stat-card"><p className="stat-label">Páginas por visitante</p><strong>{summary.visitors ? (summary.views / summary.visitors).toFixed(1) : '0'}</strong><span>Promedio del período</span></article>
      </div>

      <section className="data-card analytics-daily-card"><h2>Evolución diaria</h2>{summary.daily.length ? <div className="analytics-chart" aria-label="Visitas diarias">{summary.daily.map((item) => <div className="analytics-chart-column" key={item.date} title={`${item.date}: ${item.views} visitas, ${item.visitors} visitantes`}><span>{item.views}</span><div style={{ height: `${Math.max(4, (item.views / maxDailyViews) * 100)}%` }} /><small>{shortDate(item.date)}</small></div>)}</div> : <p className="field-hint">Todavía no hay visitas registradas en este período.</p>}</section>

      <div className="analytics-grid">
        <Ranking title="Secciones más usadas" items={summary.sections} />
        <Ranking title="Páginas más visitadas" items={summary.pages} showVisitors />
        <Ranking title="Dispositivos" items={summary.devices.map((item) => ({ ...item, label: deviceLabels[item.label] ?? item.label }))} />
        <Ranking title="Origen de las visitas" items={summary.referrers} />
      </div>
    </>}
  </div>;
}

function Ranking({ title, items, showVisitors = false }: { title: string; items: { label: string; views: number; visitors?: number }[]; showVisitors?: boolean }) {
  const max = Math.max(1, ...items.map((item) => item.views));
  return <section className="data-card analytics-ranking"><h2>{title}</h2>{items.length ? <ol>{items.map((item) => <li key={item.label}><div><strong>{item.label}</strong><span>{item.views} visitas{showVisitors && item.visitors !== undefined ? ` · ${item.visitors} visitantes` : ''}</span></div><span className="analytics-ranking-bar"><i style={{ width: `${(item.views / max) * 100}%` }} /></span></li>)}</ol> : <p className="field-hint">Sin datos todavía.</p>}</section>;
}

function shortDate(value: string) {
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}
