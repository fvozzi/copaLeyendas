import { useEffect, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { createCashExpense, deleteCashExpense, getCash } from '../lib/api';
import type { CashExpense, CashSummary } from '../types';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const initialExpense = { reason: '', quantity: 1, unitPrice: 0 };

export function AdminCashPage() {
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [expense, setExpense] = useState(initialExpense);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => getCash().then(setSummary).catch((reason: Error) => setError(reason.message));
  useEffect(() => { load(); }, []);

  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try { await createCashExpense(expense); setExpense(initialExpense); setExpenseOpen(false); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el egreso.'); } finally { setSaving(false); }
  };

  const removeExpense = async (item: CashExpense) => {
    if (!window.confirm(`Se eliminara el egreso "${item.reason}".`)) return;
    try { await deleteCashExpense(item.id); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el egreso.'); }
  };

  const calculatedAmount = expense.quantity * expense.unitPrice;
  return <div className="admin-panel">
    <div className="panel-header"><div><p className="eyebrow">Administracion</p><h1>Caja</h1></div><button className="primary-button" onClick={() => { setExpense(initialExpense); setExpenseOpen(true); }}>Registrar egreso</button></div>
    {error && <div className="inline-state">{error}</div>}
    <section className="stats-grid">
      <article className="metric-card"><p>Ingresos</p><strong>{money.format(summary?.totalIncome ?? 0)}</strong><span>Inscripciones con pago recibido</span></article>
      <article className="metric-card"><p>Egresos</p><strong>{money.format(summary?.totalExpense ?? 0)}</strong><span>Gastos registrados</span></article>
      <article className="metric-card"><p>Saldo</p><strong>{money.format(summary?.balance ?? 0)}</strong><span>Ingresos menos egresos</span></article>
    </section>
    <section className="data-card"><div className="panel-header"><div><h2>Ingresos</h2><p className="field-hint">Inscripciones no bonificadas con comprobante de pago.</p></div></div><AdminDataGrid rows={summary?.incomes ?? []} emptyMessage="Todavia no hay ingresos registrados." columns={[{ label: 'Equipo / localidad', render: (item) => <strong>{item.team}</strong> }, { label: 'Jugadoras', render: (item) => item.players }, { label: 'Monto', render: (item) => money.format(item.amount) }, { label: 'Fecha', render: (item) => new Date(item.paidAt).toLocaleDateString('es-AR') }]} /></section>
    <section className="data-card"><div className="panel-header"><div><h2>Egresos</h2><p className="field-hint">Cada monto se calcula como cantidad por valor unitario.</p></div></div><AdminDataGrid rows={summary?.expenses ?? []} onDelete={removeExpense} emptyMessage="Todavia no hay egresos registrados." columns={[{ label: 'Motivo', render: (item) => <strong>{item.reason}</strong> }, { label: 'Cantidad', render: (item) => item.quantity }, { label: 'Valor unitario', render: (item) => money.format(item.unitPrice) }, { label: 'Monto', render: (item) => money.format(item.amount) }, { label: 'Fecha', render: (item) => new Date(item.createdAt).toLocaleDateString('es-AR') }]} /></section>
    {expenseOpen && <AdminDialog title="Registrar egreso" onClose={() => setExpenseOpen(false)}><form className="editor-form" onSubmit={saveExpense}><label className="span-2">Motivo<input value={expense.reason} onChange={(event) => setExpense({ ...expense, reason: event.target.value })} minLength={2} required /></label><label>Cantidad<input type="number" min="1" step="1" value={expense.quantity} onChange={(event) => setExpense({ ...expense, quantity: Number(event.target.value) })} required /></label><label>Valor unitario<input type="number" min="0" step="1" value={expense.unitPrice} onChange={(event) => setExpense({ ...expense, unitPrice: Number(event.target.value) })} required /></label><div className="span-2"><strong>Monto: {money.format(calculatedAmount)}</strong></div><div className="span-2 form-actions"><button className="primary-button" disabled={saving}>Guardar egreso</button></div></form></AdminDialog>}
  </div>;
}
