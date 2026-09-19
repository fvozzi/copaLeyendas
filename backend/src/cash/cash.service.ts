import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { CashExpense } from './cash-expense.entity';
import { CashIncome } from './cash-income.entity';
import { CashSettings } from './cash-settings.entity';

export type CashStatus = 'PROJECTED' | 'REALIZED';
export interface IncomeInput { concept: string; payer?: string | null; amount: number; status?: CashStatus; expectedAt?: string | null; occurredAt?: string | null }
export interface ExpenseInput { reason: string; quantity: number; unitPrice: number; status?: CashStatus; expectedAt?: string | null; occurredAt?: string | null }

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
const effectiveDate = (status: CashStatus, requested: string | null | undefined, previous?: string | null) => status === 'PROJECTED' ? null : requested || previous || today();
const description = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length < 2) throw new BadRequestException('El concepto o motivo debe tener al menos dos caracteres.');
  return trimmed;
};
const expenseAmount = (quantity: number, unitPrice: number) => {
  const amount = quantity * unitPrice;
  if (!Number.isSafeInteger(amount) || amount > 2_147_483_647) throw new BadRequestException('El monto supera el máximo permitido.');
  return amount;
};

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashSettings) private settings: Repository<CashSettings>,
    @InjectRepository(CashExpense) private expenses: Repository<CashExpense>,
    @InjectRepository(CashIncome) private manualIncomes: Repository<CashIncome>,
    @InjectRepository(PairRegistration) private registrations: Repository<PairRegistration>,
  ) {}

  async summary() {
    const [settings, expenses, manualIncomes, registrations] = await Promise.all([
      this.getSettings(),
      this.expenses.find({ order: { createdAt: 'DESC' } }),
      this.manualIncomes.find({ order: { createdAt: 'DESC' } }),
      this.registrations.find({ relations: { payments: true }, order: { createdAt: 'DESC' } }),
    ]);
    const registrationIncomes = registrations.flatMap((item) => item.payments.filter((payment) => payment.amount > 0).map((payment) => ({
      id: payment.id, source: 'REGISTRATION' as const, manualIncomeId: null, registrationId: item.id,
      team: item.localityName, players: payment.players, amount: payment.amount,
      paidAt: payment.createdAt as Date | string | null, expectedAt: null as string | null,
      status: 'REALIZED' as const, createdAt: payment.createdAt,
      concept: payment.kind === 'ADDITIONAL' ? 'Jugadora adicional' : 'Inscripción',
    })));
    const otherIncomes = manualIncomes.map((item) => ({
      id: -item.id, source: 'MANUAL' as const, manualIncomeId: item.id, registrationId: null,
      team: item.payer, players: null, amount: item.amount, paidAt: item.occurredAt as Date | string | null,
      expectedAt: item.expectedAt, status: item.status, createdAt: item.createdAt, concept: item.concept,
    }));
    const incomes = [...registrationIncomes, ...otherIncomes].sort((a, b) =>
      new Date(b.paidAt ?? b.expectedAt ?? b.createdAt).getTime() - new Date(a.paidAt ?? a.expectedAt ?? a.createdAt).getTime());
    const totalIncome = incomes.filter(item => item.status === 'REALIZED').reduce((sum, item) => sum + item.amount, 0);
    const projectedIncome = incomes.filter(item => item.status === 'PROJECTED').reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = expenses.filter(item => item.status !== 'PROJECTED').reduce((sum, item) => sum + item.amount, 0);
    const projectedExpense = expenses.filter(item => item.status === 'PROJECTED').reduce((sum, item) => sum + item.amount, 0);
    return {
      feePerPlayer: settings.feePerPlayer, incomes, expenses,
      totalIncome, projectedIncome, forecastIncome: totalIncome + projectedIncome,
      totalExpense, projectedExpense, forecastExpense: totalExpense + projectedExpense,
      balance: totalIncome - totalExpense,
      forecastBalance: totalIncome + projectedIncome - totalExpense - projectedExpense,
    };
  }

  async updateFeePerPlayer(feePerPlayer: number) {
    const settings = await this.getSettings();
    settings.feePerPlayer = feePerPlayer;
    return this.settings.save(settings);
  }

  createIncome(input: IncomeInput) {
    const status = input.status ?? 'PROJECTED';
    return this.manualIncomes.save(this.manualIncomes.create({
      concept: description(input.concept), payer: input.payer?.trim() || null, amount: input.amount, status,
      expectedAt: input.expectedAt ?? null, occurredAt: effectiveDate(status, input.occurredAt),
    }));
  }

  async updateIncome(id: number, input: Partial<IncomeInput>) {
    const income = await this.manualIncomes.findOneBy({ id });
    if (!income) throw new NotFoundException('Ingreso no encontrado');
    if (input.concept !== undefined) income.concept = description(input.concept);
    if (input.payer !== undefined) income.payer = input.payer?.trim() || null;
    if (input.amount !== undefined) income.amount = input.amount;
    if (input.expectedAt !== undefined) income.expectedAt = input.expectedAt;
    income.status = input.status ?? income.status;
    income.occurredAt = effectiveDate(income.status, input.occurredAt, income.occurredAt);
    return this.manualIncomes.save(income);
  }

  async removeIncome(id: number) {
    const income = await this.manualIncomes.findOneBy({ id });
    if (!income) throw new NotFoundException('Ingreso no encontrado');
    await this.manualIncomes.remove(income);
    return { success: true };
  }

  createExpense(input: ExpenseInput) {
    const status = input.status ?? 'REALIZED';
    return this.expenses.save(this.expenses.create({
      reason: description(input.reason), quantity: input.quantity, unitPrice: input.unitPrice,
      amount: expenseAmount(input.quantity, input.unitPrice), status,
      expectedAt: input.expectedAt ?? null, occurredAt: effectiveDate(status, input.occurredAt),
    }));
  }

  async updateExpense(id: number, input: Partial<ExpenseInput>) {
    const expense = await this.expenses.findOneBy({ id });
    if (!expense) throw new NotFoundException('Egreso no encontrado');
    if (input.reason !== undefined) expense.reason = description(input.reason);
    if (input.quantity !== undefined) expense.quantity = input.quantity;
    if (input.unitPrice !== undefined) expense.unitPrice = input.unitPrice;
    expense.amount = expenseAmount(expense.quantity, expense.unitPrice);
    if (input.expectedAt !== undefined) expense.expectedAt = input.expectedAt;
    expense.status = input.status ?? expense.status;
    expense.occurredAt = effectiveDate(expense.status, input.occurredAt, expense.occurredAt);
    return this.expenses.save(expense);
  }

  async removeExpense(id: number) {
    const expense = await this.expenses.findOneBy({ id });
    if (!expense) throw new NotFoundException('Egreso no encontrado');
    await this.expenses.remove(expense);
    return { success: true };
  }

  private async getSettings() {
    let settings = await this.settings.findOneBy({ id: 1 });
    if (!settings) settings = await this.settings.save(this.settings.create({ id: 1, feePerPlayer: 15000 }));
    return settings;
  }
}
