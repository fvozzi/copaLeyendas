import { expect, it, vi } from 'vitest';
import { CashService } from './cash.service';
vi.mock('../registrations/pair-registration.entity', () => ({ PairRegistration: class {} }));
vi.mock('./cash-settings.entity', () => ({ CashSettings: class {} }));
vi.mock('./cash-expense.entity', () => ({ CashExpense: class {} }));
vi.mock('./cash-income.entity', () => ({ CashIncome: class {} }));

it('adds each payment once using its recorded amount, independently of the current roster', async () => {
  const registration = { id: 8, localityName: 'Junín', playerThreeName: null, feePerPlayer: 99999, payments: [
    { id: 1, kind: 'INITIAL', players: 2, amount: 30000, createdAt: new Date('2026-09-01') },
    { id: 2, kind: 'ADDITIONAL', players: 1, amount: 15000, createdAt: new Date('2026-09-16') },
    { id: 3, kind: 'REPLACEMENT', players: 0, amount: 0, createdAt: new Date('2026-09-17') },
  ] };
  const service = new CashService({ findOneBy: vi.fn().mockResolvedValue({ feePerPlayer: 15000 }) } as never,
    { find: vi.fn().mockResolvedValue([{ amount: 5000 }]) } as never,
    { find: vi.fn().mockResolvedValue([]) } as never,
    { find: vi.fn().mockResolvedValue([registration, { id: 9, payments: [] }]) } as never);
  const summary = await service.summary();
  expect(summary).toMatchObject({ totalIncome: 45000, totalExpense: 5000, balance: 40000 });
  expect(summary.incomes).toHaveLength(2);
  expect(summary.incomes[0]).toMatchObject({ id: 2, registrationId: 8, players: 1, amount: 15000, concept: 'Jugadora adicional' });
  registration.playerThreeName = 'Suplente' as never;
  expect((await service.summary()).totalIncome).toBe(45000);
});

it('separates effective and projected amounts without counting registration payments twice', async () => {
  const service = new CashService(
    { findOneBy: vi.fn().mockResolvedValue({ feePerPlayer: 15000 }) } as never,
    { find: vi.fn().mockResolvedValue([
      { id: 1, amount: 20, status: 'REALIZED', occurredAt: '2026-09-10' },
      { id: 2, amount: 80, status: 'PROJECTED', expectedAt: '2026-10-10' },
    ]) } as never,
    { find: vi.fn().mockResolvedValue([
      { id: 1, concept: 'Auspicio', payer: 'Dabber', amount: 100, status: 'PROJECTED', expectedAt: '2026-10-01', occurredAt: null, createdAt: new Date('2026-09-01') },
      { id: 2, concept: 'Donación', payer: null, amount: 50, status: 'REALIZED', expectedAt: null, occurredAt: '2026-09-02', createdAt: new Date('2026-09-01') },
    ]) } as never,
    { find: vi.fn().mockResolvedValue([{ id: 4, localityName: 'Junín', payments: [{ id: 3, amount: 30, players: 2, kind: 'INITIAL', createdAt: new Date('2026-09-03') }] }]) } as never,
  );
  const summary = await service.summary();
  expect(summary).toMatchObject({ totalIncome: 80, projectedIncome: 100, forecastIncome: 180,
    totalExpense: 20, projectedExpense: 80, forecastExpense: 100, balance: 60, forecastBalance: 80 });
  expect(summary.incomes).toHaveLength(3);
  expect(summary.incomes.find(item => item.manualIncomeId === 1)).toMatchObject({ id: -1, team: 'Dabber', status: 'PROJECTED' });
});

it('creates projections and realizes income and expenses on the supplied date', async () => {
  const incomes = new Map<number, any>();
  const expenses = new Map<number, any>();
  const incomeRepository = {
    create: vi.fn((value) => value), save: vi.fn(async (value) => { const saved = { ...value, id: value.id ?? 1 }; incomes.set(saved.id, saved); return saved; }),
    findOneBy: vi.fn(async ({ id }) => incomes.get(id) ?? null),
  };
  const expenseRepository = {
    create: vi.fn((value) => value), save: vi.fn(async (value) => { const saved = { ...value, id: value.id ?? 1 }; expenses.set(saved.id, saved); return saved; }),
    findOneBy: vi.fn(async ({ id }) => expenses.get(id) ?? null),
  };
  const service = new CashService({} as never, expenseRepository as never, incomeRepository as never, {} as never);
  await service.createIncome({ concept: ' Auspicio ', payer: ' Guastavino ', amount: 1000, status: 'PROJECTED', expectedAt: '2026-10-01' });
  await service.createExpense({ reason: ' Pelotas ', quantity: 2, unitPrice: 200, status: 'PROJECTED', expectedAt: '2026-10-02' });
  expect(incomes.get(1)).toMatchObject({ concept: 'Auspicio', payer: 'Guastavino', status: 'PROJECTED', occurredAt: null });
  expect(expenses.get(1)).toMatchObject({ reason: 'Pelotas', amount: 400, status: 'PROJECTED', occurredAt: null });
  await service.updateIncome(1, { status: 'REALIZED', occurredAt: '2026-10-03' });
  await service.updateExpense(1, { status: 'REALIZED', occurredAt: '2026-10-04', unitPrice: 250 });
  expect(incomes.get(1)).toMatchObject({ status: 'REALIZED', occurredAt: '2026-10-03' });
  expect(expenses.get(1)).toMatchObject({ status: 'REALIZED', occurredAt: '2026-10-04', amount: 500 });
  await service.updateIncome(1, { status: 'PROJECTED' });
  expect(incomes.get(1).occurredAt).toBeNull();
});
