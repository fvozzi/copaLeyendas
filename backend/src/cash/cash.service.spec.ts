import { expect, it, vi } from 'vitest';
import { CashService } from './cash.service';
vi.mock('../registrations/pair-registration.entity', () => ({ PairRegistration: class {} }));
vi.mock('./cash-settings.entity', () => ({ CashSettings: class {} }));
vi.mock('./cash-expense.entity', () => ({ CashExpense: class {} }));

it('adds each payment once using its recorded amount, independently of the current roster', async () => {
  const registration = { id: 8, localityName: 'Junín', playerThreeName: null, feePerPlayer: 99999, payments: [
    { id: 1, kind: 'INITIAL', players: 2, amount: 30000, createdAt: new Date('2026-09-01') },
    { id: 2, kind: 'ADDITIONAL', players: 1, amount: 15000, createdAt: new Date('2026-09-16') },
    { id: 3, kind: 'REPLACEMENT', players: 0, amount: 0, createdAt: new Date('2026-09-17') },
  ] };
  const service = new CashService({ findOneBy: vi.fn().mockResolvedValue({ feePerPlayer: 15000 }) } as never,
    { find: vi.fn().mockResolvedValue([{ amount: 5000 }]) } as never,
    { find: vi.fn().mockResolvedValue([registration, { id: 9, payments: [] }]) } as never);
  const summary = await service.summary();
  expect(summary).toMatchObject({ totalIncome: 45000, totalExpense: 5000, balance: 40000 });
  expect(summary.incomes).toHaveLength(2);
  expect(summary.incomes[0]).toMatchObject({ id: 2, registrationId: 8, players: 1, amount: 15000, concept: 'Jugadora adicional' });
  registration.playerThreeName = 'Suplente' as never;
  expect((await service.summary()).totalIncome).toBe(45000);
});
