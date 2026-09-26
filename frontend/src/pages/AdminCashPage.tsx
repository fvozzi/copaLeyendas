import { useEffect, useRef, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { CashProjectionChart } from '../components/CashProjectionChart';
import {
  createCashExpense, createCashIncome, deleteCashExpense, deleteCashIncome, getCash,
  openRegistrationPaymentProof, updateCashExpense, updateCashIncome,
} from '../lib/api';
import type { CashExpense, CashExpensePayload, CashIncome, CashIncomePayload, CashStatus, CashSummary } from '../types';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
const initialIncome: CashIncomePayload = { concept: '', payer: '', amount: 0, status: 'PROJECTED', expectedAt: null, occurredAt: null };
const initialExpense: CashExpensePayload = { reason: '', quantity: 1, unitPrice: 0, status: 'PROJECTED', expectedAt: null, occurredAt: null };
const dateLabel = (value: string | null) => value ? /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? value.split('-').reverse().join('/') : new Date(value).toLocaleDateString('es-AR') : '—';
const statusChip = (status: CashStatus) => <span className={`status-chip ${status === 'REALIZED' ? 'status-live' : 'status-review'}`}>{status === 'REALIZED' ? 'Efectivo' : 'Proyectado'}</span>;

export function AdminCashPage() {
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [tab, setTab] = useState<'incomes' | 'expenses'>('incomes');
  const [income, setIncome] = useState<CashIncomePayload>(initialIncome);
  const [expense, setExpense] = useState<CashExpensePayload>(initialExpense);
  const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<'income' | 'expense' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const load = async () => {
    try { setSummary(await getCash()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cargar la caja.'); }
  };
  useEffect(() => { void load(); }, []);

  const openIncome = (item?: CashIncome) => {
    setTab('incomes'); setEditingIncomeId(item?.manualIncomeId ?? null); setFormError(null);
    setIncome(item ? { concept: item.concept, payer: item.team ?? '', amount: item.amount,
      status: item.status, expectedAt: item.expectedAt, occurredAt: item.paidAt?.slice(0, 10) ?? null } : { ...initialIncome });
    setDialog('income');
  };
  const openExpense = (item?: CashExpense) => {
    setTab('expenses'); setEditingExpenseId(item?.id ?? null); setFormError(null);
    setExpense(item ? { reason: item.reason, quantity: item.quantity, unitPrice: item.unitPrice,
      status: item.status, expectedAt: item.expectedAt, occurredAt: item.occurredAt } : { ...initialExpense });
    setDialog('expense');
  };

  const saveIncome = async (event: React.FormEvent) => {
    event.preventDefault(); if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setFormError(null);
    try {
      if (editingIncomeId === null) await createCashIncome(income);
      else await updateCashIncome(editingIncomeId, income);
      setDialog(null); await load();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el ingreso.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault(); if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setFormError(null);
    try {
      if (editingExpenseId === null) await createCashExpense(expense);
      else await updateCashExpense(editingExpenseId, expense);
      setDialog(null); await load();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'No se pudo guardar el egreso.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const realizeIncome = async (item: CashIncome) => {
    if (item.manualIncomeId === null) return;
    try { await updateCashIncome(item.manualIncomeId, { status: 'REALIZED', occurredAt: today() }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo efectivizar el ingreso.'); }
  };
  const realizeExpense = async (item: CashExpense) => {
    try { await updateCashExpense(item.id, { status: 'REALIZED', occurredAt: today() }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo efectivizar el egreso.'); }
  };
  const removeIncome = async (item: CashIncome) => {
    if (item.manualIncomeId === null || !window.confirm(`¿Eliminar el ingreso "${item.concept}"?`)) return;
    try { await deleteCashIncome(item.manualIncomeId); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el ingreso.'); }
  };
  const removeExpense = async (item: CashExpense) => {
    if (!window.confirm(`¿Eliminar el egreso "${item.reason}"?`)) return;
    try { await deleteCashExpense(item.id); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el egreso.'); }
  };

  return <div className="admin-panel cash-page">
    <div className="panel-header"><div><p className="eyebrow">Administración</p><h1>Caja</h1></div></div>
    {error && <div className="inline-state" role="alert">{error}</div>}
    <section className="stats-grid cash-stats">
      <article className="metric-card"><p>Ingresos</p><strong>{money.format(summary?.totalIncome ?? 0)}</strong><span>Cobrados, incluidas inscripciones</span></article>
      <article className="metric-card"><p>Egresos</p><strong>{money.format(summary?.totalExpense ?? 0)}</strong><span>Pagados</span></article>
      <article className="metric-card"><p>Egresos proyectados</p><strong>{money.format(summary?.projectedExpense ?? 0)}</strong><span>Total final: {money.format(summary?.forecastExpense ?? 0)}</span></article>
      <article className="metric-card"><p>Ingresos calculados</p><strong>{money.format(summary?.calculatedIncome ?? 0)}</strong><span>{summary?.minimumPairsToCharge == null
        ? 'No se puede calcular sin valor de inscripción'
        : summary.minimumPairsToCharge === 0
          ? 'Los ingresos actuales y proyectados ya cubren los gastos'
          : `${summary.minimumPairsToCharge} ${summary.minimumPairsToCharge === 1 ? 'pareja' : 'parejas'} más a cobrar · ${money.format(summary.pairFee)} por pareja`}</span></article>
    </section>
    {summary && <section className="data-card cash-coverage-summary" aria-labelledby="cash-coverage-title">
      <div><h2 id="cash-coverage-title">Cobertura final</h2><p>El cálculo contempla los ingresos cobrados, los auspicios proyectados y todos los egresos pagados y proyectados.</p></div>
      <div className="cash-coverage-values">
        <span>Faltante exacto<strong>{money.format(summary.incomeToCover)}</strong></span>
        <span>Parejas ya pagas<strong>{summary.paidPairCount}</strong></span>
        <span>Parejas pendientes de cobro<strong>{summary.chargeablePairCount}</strong></span>
        <span>Parejas bonificadas<strong>{summary.waivedPairCount}</strong></span>
      </div>
    </section>}
    <CashProjectionChart summary={summary} />
    <div className="program-tabs cash-tabs" role="tablist" aria-label="Movimientos de caja">
      <button type="button" role="tab" id="cash-tab-incomes" aria-controls="cash-panel-incomes" aria-selected={tab === 'incomes'} className={tab === 'incomes' ? 'is-selected' : ''} onClick={() => setTab('incomes')}>Ingresos</button>
      <button type="button" role="tab" id="cash-tab-expenses" aria-controls="cash-panel-expenses" aria-selected={tab === 'expenses'} className={tab === 'expenses' ? 'is-selected' : ''} onClick={() => setTab('expenses')}>Egresos</button>
    </div>
    {tab === 'incomes' ? <section className="data-card" role="tabpanel" id="cash-panel-incomes" aria-labelledby="cash-tab-incomes">
      <div className="panel-header"><div><h2>Ingresos</h2><p className="field-hint">Los pagos de inscripción se incorporan automáticamente. Registrá aquí auspicios y otros ingresos.</p></div><button className="primary-button" onClick={() => openIncome()}>Agregar ingreso</button></div>
      <AdminDataGrid rows={summary?.incomes ?? []} emptyMessage="Todavía no hay ingresos." columns={[
        { label: 'Concepto', render: (item) => <strong>{item.concept}</strong> },
        { label: 'Equipo / auspiciante', render: (item) => item.team || '—' },
        { label: 'Monto', render: (item) => money.format(item.amount) },
        { label: 'Estado', render: (item) => statusChip(item.status) },
        { label: 'Previsto', render: (item) => dateLabel(item.expectedAt) },
        { label: 'Cobrado', render: (item) => dateLabel(item.paidAt) },
      ]} renderActions={(item) => item.source === 'REGISTRATION'
        ? <button className="inline-link" onClick={() => openRegistrationPaymentProof(item.registrationId!, item.id).catch((reason: Error) => setError(reason.message))}>Ver comprobante</button>
        : <><button className="inline-link" onClick={() => openIncome(item)}>Editar</button>{item.status === 'PROJECTED' && <button className="inline-link" onClick={() => realizeIncome(item)}>Efectivizar</button>}<button className="danger-link" onClick={() => removeIncome(item)}>Eliminar</button></>} />
    </section> : <section className="data-card" role="tabpanel" id="cash-panel-expenses" aria-labelledby="cash-tab-expenses">
      <div className="panel-header"><div><h2>Egresos</h2><p className="field-hint">Cada monto se calcula como cantidad por valor unitario.</p></div><button className="primary-button" onClick={() => openExpense()}>Agregar egreso</button></div>
      <AdminDataGrid rows={summary?.expenses ?? []} emptyMessage="Todavía no hay egresos." columns={[
        { label: 'Motivo', render: (item) => <strong>{item.reason}</strong> },
        { label: 'Cantidad', render: (item) => item.quantity },
        { label: 'Valor unitario', render: (item) => money.format(item.unitPrice) },
        { label: 'Monto', render: (item) => money.format(item.amount) },
        { label: 'Estado', render: (item) => statusChip(item.status) },
        { label: 'Previsto', render: (item) => dateLabel(item.expectedAt) },
        { label: 'Pagado', render: (item) => dateLabel(item.occurredAt) },
      ]} renderActions={(item) => <><button className="inline-link" onClick={() => openExpense(item)}>Editar</button>{item.status === 'PROJECTED' && <button className="inline-link" onClick={() => realizeExpense(item)}>Efectivizar</button>}<button className="danger-link" onClick={() => removeExpense(item)}>Eliminar</button></>} />
    </section>}
    {dialog === 'income' && <AdminDialog title={editingIncomeId === null ? 'Agregar ingreso' : 'Editar ingreso'} onClose={() => setDialog(null)}><form className="editor-form" onSubmit={saveIncome}>
      {formError && <div className="form-error span-2" role="alert">{formError}</div>}
      <label className="span-2">Concepto<input value={income.concept} onChange={(event) => setIncome({ ...income, concept: event.target.value })} minLength={2} required placeholder="Auspicio, donación…" /></label>
      <label className="span-2">Auspiciante / pagador<input value={income.payer} onChange={(event) => setIncome({ ...income, payer: event.target.value })} placeholder="Opcional" /></label>
      <label>Monto<input type="number" min="1" step="1" value={income.amount} onChange={(event) => setIncome({ ...income, amount: Number(event.target.value) })} required /></label>
      <label>Estado<select value={income.status} onChange={(event) => { const status = event.target.value as CashStatus; setIncome({ ...income, status, occurredAt: status === 'REALIZED' ? income.occurredAt ?? today() : null }); }}><option value="PROJECTED">Proyectado</option><option value="REALIZED">Efectivo</option></select></label>
      <label>Fecha prevista<input type="date" value={income.expectedAt ?? ''} onChange={(event) => setIncome({ ...income, expectedAt: event.target.value || null })} /></label>
      {income.status === 'REALIZED' && <label>Fecha de cobro<input type="date" value={income.occurredAt ?? ''} onChange={(event) => setIncome({ ...income, occurredAt: event.target.value || null })} required /></label>}
      <div className="span-2 form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ingreso'}</button></div>
    </form></AdminDialog>}
    {dialog === 'expense' && <AdminDialog title={editingExpenseId === null ? 'Agregar egreso' : 'Editar egreso'} onClose={() => setDialog(null)}><form className="editor-form" onSubmit={saveExpense}>
      {formError && <div className="form-error span-2" role="alert">{formError}</div>}
      <label className="span-2">Motivo<input value={expense.reason} onChange={(event) => setExpense({ ...expense, reason: event.target.value })} minLength={2} required /></label>
      <label>Cantidad<input type="number" min="1" step="1" value={expense.quantity} onChange={(event) => setExpense({ ...expense, quantity: Number(event.target.value) })} required /></label>
      <label>Valor unitario<input type="number" min="0" step="1" value={expense.unitPrice} onChange={(event) => setExpense({ ...expense, unitPrice: Number(event.target.value) })} required /></label>
      <div className="span-2"><strong>Monto: {money.format(expense.quantity * expense.unitPrice)}</strong></div>
      <label>Estado<select value={expense.status} onChange={(event) => { const status = event.target.value as CashStatus; setExpense({ ...expense, status, occurredAt: status === 'REALIZED' ? expense.occurredAt ?? today() : null }); }}><option value="PROJECTED">Proyectado</option><option value="REALIZED">Efectivo</option></select></label>
      <label>Fecha prevista<input type="date" value={expense.expectedAt ?? ''} onChange={(event) => setExpense({ ...expense, expectedAt: event.target.value || null })} /></label>
      {expense.status === 'REALIZED' && <label>Fecha de pago<input type="date" value={expense.occurredAt ?? ''} onChange={(event) => setExpense({ ...expense, occurredAt: event.target.value || null })} required /></label>}
      <div className="span-2 form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar egreso'}</button></div>
    </form></AdminDialog>}
  </div>;
}
