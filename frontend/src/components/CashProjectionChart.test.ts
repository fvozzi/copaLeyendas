import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CashProjectionChart } from './CashProjectionChart';
import type { CashSummary } from '../types';

afterEach(() => vi.useRealTimers());

it('marks the dates and minimum balance of a forecast shortfall, leaving undated items separate', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-19T15:00:00Z'));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const summary: CashSummary = {
    feePerPlayer: 15000,
    incomes: [
      { id: 1, source: 'MANUAL', manualIncomeId: 1, registrationId: null, concept: 'Caja inicial', team: null, players: null, amount: 100, status: 'REALIZED', expectedAt: null, paidAt: '2026-09-18', createdAt: '2026-09-18' },
      { id: 2, source: 'MANUAL', manualIncomeId: 2, registrationId: null, concept: 'Auspicio', team: null, players: null, amount: 150, status: 'PROJECTED', expectedAt: '2026-09-25', paidAt: null, createdAt: '2026-09-19' },
    ],
    expenses: [
      { id: 3, reason: 'Cancha', quantity: 1, unitPrice: 200, amount: 200, status: 'PROJECTED', expectedAt: '2026-09-20', occurredAt: null, createdAt: '2026-09-19' },
      { id: 4, reason: 'Sin fecha', quantity: 1, unitPrice: 100, amount: 100, status: 'PROJECTED', expectedAt: null, occurredAt: null, createdAt: '2026-09-19' },
    ],
    totalIncome: 100, projectedIncome: 150, forecastIncome: 250,
    totalExpense: 0, projectedExpense: 300, forecastExpense: 300,
    balance: 100, forecastBalance: -50,
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(CashProjectionChart, { summary })));
    expect(container.querySelectorAll('.cash-chart path')).toHaveLength(2);
    expect(container.querySelector('.cash-gap-summary')?.textContent).toContain('Desde el 20/09/26; se recupera el 25/09/26');
    expect(container.querySelector('.cash-gap-summary')?.textContent).toContain('100');
    expect(container.querySelector('.cash-undated')?.textContent).toContain('50');
    expect(container.querySelector('.cash-chart-deficit-point title')?.textContent).toContain('20/09/26');
    expect(container.querySelector('.cash-chart-deficit-point title')?.textContent).toContain('200');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
