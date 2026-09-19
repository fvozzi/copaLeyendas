import type { CashSummary } from '../types';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

export function CashProjectionChart({ summary }: { summary: CashSummary | null }) {
  const groups = [
    { label: 'Ingresos', current: summary?.totalIncome ?? 0, forecast: summary?.forecastIncome ?? 0 },
    { label: 'Egresos', current: summary?.totalExpense ?? 0, forecast: summary?.forecastExpense ?? 0 },
    { label: 'Saldo', current: summary?.balance ?? 0, forecast: summary?.forecastBalance ?? 0 },
  ];
  const values = groups.flatMap(group => [group.current, group.forecast]);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const scale = 150 / (maximum - minimum || 1);
  const baseline = 28 + maximum * scale;
  return <section className="data-card cash-projection-card" aria-labelledby="cash-projection-title">
    <div className="panel-header"><div><h2 id="cash-projection-title">Proyección de caja</h2><p className="field-hint">Proyectado = efectivo más movimientos pendientes. Las inscripciones pagadas ya forman parte del efectivo.</p></div></div>
    <div className="cash-chart-legend"><span><i className="cash-legend-current" /> Efectivo</span><span><i className="cash-legend-forecast" /> Efectivo + proyectado</span></div>
    {values.every(value => value === 0) ? <p className="inline-state">Todavía no hay movimientos para graficar.</p> : <div className="cash-chart-scroll"><svg className="cash-chart" viewBox="0 0 740 235" role="img" aria-labelledby="cash-chart-title cash-chart-description">
      <title id="cash-chart-title">Comparación de caja efectiva y proyectada</title>
      <desc id="cash-chart-description">Ingresos: {money.format(groups[0].current)} efectivos y {money.format(groups[0].forecast)} incluyendo proyecciones. Egresos: {money.format(groups[1].current)} efectivos y {money.format(groups[1].forecast)} incluyendo proyecciones. Saldo: {money.format(groups[2].current)} efectivo y {money.format(groups[2].forecast)} proyectado.</desc>
      <line x1="30" x2="710" y1={baseline} y2={baseline} className="cash-chart-zero" />
      {groups.map((group, index) => {
        const center = 145 + index * 225;
        return <g key={group.label}>
          {([{ value: group.current, x: center - 68, className: 'cash-chart-current' }, { value: group.forecast, x: center + 4, className: 'cash-chart-forecast' }] as const).map(bar => {
            const height = Math.abs(bar.value) * scale;
            const y = bar.value >= 0 ? baseline - height : baseline;
            return <g key={bar.className}>
              <rect className={bar.className} x={bar.x} y={y} width="64" height={height} rx="4"><title>{group.label}: {money.format(bar.value)}</title></rect>
              <text className="cash-chart-value" x={bar.x + 32} y={bar.value >= 0 ? y - 7 : y + height + 16} textAnchor="middle">{compact.format(bar.value)}</text>
            </g>;
          })}
          <text className="cash-chart-category" x={center} y="224" textAnchor="middle">{group.label}</text>
        </g>;
      })}
    </svg></div>}
    <p className="cash-projection-totals">Pendiente de ingresar: <strong>{money.format(summary?.projectedIncome ?? 0)}</strong> · Pendiente de egresar: <strong>{money.format(summary?.projectedExpense ?? 0)}</strong></p>
  </section>;
}
