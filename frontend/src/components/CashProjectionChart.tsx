import type { CashSummary } from '../types';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const argentinaDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
const today = () => argentinaDay.format(new Date());
const dayOf = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : argentinaDay.format(new Date(value));
const dateLabel = (value: string) => { const [year, month, day] = value.split('-'); return `${day}/${month}/${year.slice(2)}`; };

type DailyMovements = { effectiveIncome: number; effectiveExpense: number; projectedIncome: number; projectedExpense: number };
type TimelinePoint = { date: string; effective: number; projected: number; movements: DailyMovements };

function cashTimeline(summary: Pick<CashSummary, 'incomes' | 'expenses'>, currentDay: string) {
  const days = new Map<string, DailyMovements>();
  const undated = { income: 0, expense: 0 };
  const add = (date: string, kind: keyof DailyMovements, amount: number) => {
    const movements = days.get(date) ?? { effectiveIncome: 0, effectiveExpense: 0, projectedIncome: 0, projectedExpense: 0 };
    movements[kind] += amount;
    days.set(date, movements);
  };
  for (const income of summary.incomes) {
    if (income.status === 'PROJECTED') {
      if (income.expectedAt) add(dayOf(income.expectedAt), 'projectedIncome', income.amount);
      else undated.income += income.amount;
    } else add(dayOf(income.paidAt ?? income.createdAt), 'effectiveIncome', income.amount);
  }
  for (const expense of summary.expenses) {
    if (expense.status === 'PROJECTED') {
      if (expense.expectedAt) add(dayOf(expense.expectedAt), 'projectedExpense', expense.amount);
      else undated.expense += expense.amount;
    } else add(dayOf(expense.occurredAt ?? expense.createdAt), 'effectiveExpense', expense.amount);
  }
  if (!days.has(currentDay)) days.set(currentDay, { effectiveIncome: 0, effectiveExpense: 0, projectedIncome: 0, projectedExpense: 0 });
  let effective = 0;
  let projected = 0;
  const points: TimelinePoint[] = [...days].sort(([left], [right]) => left.localeCompare(right)).map(([date, movements]) => {
    effective += movements.effectiveIncome - movements.effectiveExpense;
    projected += movements.effectiveIncome + movements.projectedIncome - movements.effectiveExpense - movements.projectedExpense;
    return { date, effective, projected, movements };
  });
  const gaps: { start: string; end: string | null; minimum: number }[] = [];
  let gap: { start: string; end: string | null; minimum: number } | null = null;
  for (const point of points) {
    if (point.projected < 0) {
      if (!gap) gap = { start: point.date, end: null, minimum: point.projected };
      else gap.minimum = Math.min(gap.minimum, point.projected);
    } else if (gap) { gap.end = point.date; if (point.date >= currentDay) gaps.push(gap); gap = null; }
  }
  if (gap) gaps.push(gap);
  return { points, gaps, undated, hasDatedMovements: days.size > 1 || points[0]?.movements.effectiveIncome !== 0 || points[0]?.movements.effectiveExpense !== 0 || points[0]?.movements.projectedIncome !== 0 || points[0]?.movements.projectedExpense !== 0 };
}

export function CashProjectionChart({ summary }: { summary: CashSummary | null }) {
  const currentDay = today();
  const { points, gaps, undated, hasDatedMovements } = cashTimeline(summary ?? { incomes: [], expenses: [] }, currentDay);
  const width = Math.max(760, (points.length + 1) * 105);
  const left = 82, right = width - 30, top = 28, bottom = 235;
  const values = points.flatMap(point => [point.effective, point.projected]);
  const minimum = Math.min(0, ...values), maximum = Math.max(0, ...values);
  const padding = Math.max((maximum - minimum) * 0.12, 1);
  const y = (value: number) => top + ((maximum + padding - value) / (maximum - minimum + 2 * padding)) * (bottom - top);
  const x = (index: number) => points.length === 1 ? (left + right) / 2 : left + (index / (points.length - 1)) * (right - left);
  const path = (key: 'effective' | 'projected') => points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point[key])}`).join(' ');
  const datedBalance = points[points.length - 1]?.projected ?? 0;
  return <section className="data-card cash-projection-card" aria-labelledby="cash-projection-title">
    <div className="panel-header"><div><h2 id="cash-projection-title">Proyección de caja</h2><p className="field-hint">Cada punto reúne los cobros y pagos de esa fecha. La línea proyectada suma los movimientos pendientes en su fecha prevista.</p></div></div>
    <div className="cash-chart-legend"><span><i className="cash-legend-current" /> Saldo efectivo</span><span><i className="cash-legend-forecast" /> Saldo con proyecciones fechadas</span><span><i className="cash-legend-deficit" /> Saldo proyectado negativo</span></div>
    {!summary || !hasDatedMovements ? <p className="inline-state">Agregá movimientos con fecha para ver la evolución de caja.</p> : <div className="cash-chart-scroll"><svg className="cash-chart" style={{ minWidth: width }} viewBox={`0 0 ${width} 300`} role="img" aria-labelledby="cash-chart-title cash-chart-description">
      <title id="cash-chart-title">Evolución por fecha del saldo efectivo y proyectado</title>
      <desc id="cash-chart-description">Saldo efectivo actual: {money.format(summary.balance)}. Saldo al finalizar los movimientos fechados: {money.format(datedBalance)}. {gaps.length ? `${gaps.length} período(s) con saldo proyectado negativo.` : 'Sin descalces futuros de saldo proyectado.'} Los pendientes sin fecha no aparecen en las líneas.</desc>
      {[minimum, 0, maximum].filter((value, index, all) => all.indexOf(value) === index).map(value => <g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className={value === 0 ? 'cash-chart-zero' : 'cash-chart-grid'} /><text x={left - 10} y={y(value) + 4} textAnchor="end" className="cash-chart-tick">{compact.format(value)}</text></g>)}
      <path d={path('effective')} className="cash-chart-current-line" />
      <path d={path('projected')} className="cash-chart-forecast-line" />
      {points.map((point, index) => {
        const deficit = gaps.some(gap => point.date >= gap.start && (gap.end === null || point.date < gap.end));
        return <g key={point.date}>
        <circle cx={x(index)} cy={y(point.effective)} r="4" className="cash-chart-current-point"><title>{dateLabel(point.date)} · Efectivo: {money.format(point.effective)}</title></circle>
        <circle cx={x(index)} cy={y(point.projected)} r={deficit ? 6 : 4} className={deficit ? 'cash-chart-deficit-point' : 'cash-chart-forecast-point'}><title>{dateLabel(point.date)} · Proyectado: {money.format(point.projected)} · Ingresos previstos: {money.format(point.movements.projectedIncome)} · Egresos previstos: {money.format(point.movements.projectedExpense)}</title></circle>
        <text x={x(index)} y="266" textAnchor="middle" className={point.date === currentDay ? 'cash-chart-today' : 'cash-chart-date'}>{point.date === currentDay ? 'Hoy · ' : ''}{dateLabel(point.date)}</text>
      </g>;
      })}
    </svg></div>}
    {gaps.length > 0 && <div className="cash-gap-summary"><strong>Fechas con faltante de caja</strong><ul>{gaps.map(gap => <li key={gap.start}>Desde el {dateLabel(gap.start)}{gap.end ? `; se recupera el ${dateLabel(gap.end)}` : '; sin recuperación prevista'}; saldo mínimo {money.format(gap.minimum)}.</li>)}</ul></div>}
    {summary && hasDatedMovements && !gaps.length && <p className="cash-gap-none">No se proyectan saldos negativos desde hoy.</p>}
    {(undated.income !== 0 || undated.expense !== 0) && <p className="cash-undated">Pendientes sin fecha, fuera del gráfico: ingresos <strong>{money.format(undated.income)}</strong> · egresos <strong>{money.format(undated.expense)}</strong>. Saldo si se concretan todos: <strong>{money.format(summary?.forecastBalance ?? 0)}</strong>.</p>}
    <p className="cash-projection-totals">Pendiente de ingresar: <strong>{money.format(summary?.projectedIncome ?? 0)}</strong> · Pendiente de egresar: <strong>{money.format(summary?.projectedExpense ?? 0)}</strong></p>
  </section>;
}
