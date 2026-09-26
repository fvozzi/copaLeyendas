import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminCashPage } from './AdminCashPage';
import { createCashExpense, createCashIncome, getCash, updateCashExpense, updateCashIncome } from '../lib/api';
import type { CashSummary } from '../types';

vi.mock('../lib/api', () => ({ getCash: vi.fn(), createCashIncome: vi.fn(), updateCashIncome: vi.fn(), deleteCashIncome: vi.fn(),
  createCashExpense: vi.fn(), updateCashExpense: vi.fn(), deleteCashExpense: vi.fn(), openRegistrationPaymentProof: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); });

const summary: CashSummary = {
  feePerPlayer: 15000,
  incomes: [
    { id: 1, source: 'REGISTRATION', manualIncomeId: null, registrationId: 7, team: 'Junín', players: 2,
      concept: 'Inscripción', amount: 30000, status: 'REALIZED', expectedAt: null, paidAt: '2026-09-17T12:00:00.000Z', createdAt: '2026-09-17T12:00:00.000Z' },
    { id: -2, source: 'MANUAL', manualIncomeId: 2, registrationId: null, team: 'Guastavino', players: null,
      concept: 'Auspicio', amount: 50000, status: 'PROJECTED', expectedAt: '2026-10-01', paidAt: null, createdAt: '2026-09-19T12:00:00.000Z' },
  ],
  expenses: [{ id: 4, reason: 'Pelotas', quantity: 12, unitPrice: 10000, amount: 120000,
    status: 'PROJECTED', expectedAt: '2026-10-02', occurredAt: null, createdAt: '2026-09-19T12:00:00.000Z' }],
  totalIncome: 30000, projectedIncome: 50000, forecastIncome: 80000,
  totalExpense: 0, projectedExpense: 120000, forecastExpense: 120000,
  balance: 30000, forecastBalance: -40000,
  incomeToCover: 40000, calculatedIncome: 60000, pairFee: 30000, minimumPairsToCharge: 2,
  paidPairCount: 1, chargeablePairCount: 5, waivedPairCount: 2,
};

async function render() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(getCash).mockResolvedValue(summary);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(AdminCashPage)));
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('shows effective totals, projected chart and separate income and expense tabs', async () => {
  await render();
  expect(container.querySelectorAll('.cash-stats strong')[0].textContent).toContain('30.000');
  expect(container.querySelectorAll('.cash-stats strong')[2].textContent).toContain('120.000');
  expect(container.querySelectorAll('.cash-stats strong')[3].textContent).toContain('60.000');
  expect(container.querySelector('.cash-stats')?.textContent).toContain('2 parejas más a cobrar');
  expect(container.querySelector('.cash-coverage-summary')?.textContent).toContain('Parejas bonificadas2');
  expect(container.querySelector('.cash-chart[role="img"]')).toBeTruthy();
  expect(container.querySelector('.cash-chart desc')?.textContent).toContain('40.000');
  expect(container.querySelector('.cash-chart desc')?.textContent).toContain('saldo proyectado negativo');
  expect(container.querySelectorAll('.cash-chart path')).toHaveLength(2);
  expect(container.querySelector('#cash-panel-incomes')?.textContent).toContain('Auspicio');
  expect(container.querySelector('#cash-panel-expenses')).toBeNull();
  await act(async () => (container.querySelector('#cash-tab-expenses') as HTMLButtonElement).click());
  expect(container.querySelector('#cash-panel-expenses')?.textContent).toContain('Pelotas');
  expect(container.querySelector('#cash-panel-incomes')).toBeNull();
});

it('creates a projected sponsor income and can realize both kinds of movement', async () => {
  await render();
  await act(async () => (container.querySelector('#cash-panel-incomes .primary-button') as HTMLButtonElement).click());
  const form = document.querySelector('[role="dialog"] form') as HTMLFormElement;
  const inputs = form.querySelectorAll('input');
  await type(inputs[0] as HTMLInputElement, 'Nuevo auspicio');
  await type(inputs[1] as HTMLInputElement, 'Dabber');
  await type(inputs[2] as HTMLInputElement, '70000');
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(createCashIncome).toHaveBeenCalledWith(expect.objectContaining({ concept: 'Nuevo auspicio', payer: 'Dabber', amount: 70000, status: 'PROJECTED' }));
  const incomeRow = [...container.querySelectorAll('#cash-panel-incomes tbody tr')].find(row => row.textContent?.includes('Auspicio'))!;
  await act(async () => ([...incomeRow.querySelectorAll('button')].find(button => button.textContent === 'Efectivizar') as HTMLButtonElement).click());
  expect(updateCashIncome).toHaveBeenCalledWith(2, { status: 'REALIZED', occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  await act(async () => (container.querySelector('#cash-tab-expenses') as HTMLButtonElement).click());
  const expenseRow = container.querySelector('#cash-panel-expenses tbody tr')!;
  await act(async () => ([...expenseRow.querySelectorAll('button')].find(button => button.textContent === 'Efectivizar') as HTMLButtonElement).click());
  expect(updateCashExpense).toHaveBeenCalledWith(4, { status: 'REALIZED', occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
});

it('creates an expense projection from its tab', async () => {
  await render();
  await act(async () => (container.querySelector('#cash-tab-expenses') as HTMLButtonElement).click());
  await act(async () => (container.querySelector('#cash-panel-expenses .primary-button') as HTMLButtonElement).click());
  const form = document.querySelector('[role="dialog"] form') as HTMLFormElement;
  expect((form.querySelector('select') as HTMLSelectElement).value).toBe('PROJECTED');
  await type(form.querySelector('input') as HTMLInputElement, 'Pelotas nuevas');
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(createCashExpense).toHaveBeenCalledWith(expect.objectContaining({ reason: 'Pelotas nuevas', status: 'PROJECTED', quantity: 1 }));
});
