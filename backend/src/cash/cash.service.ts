import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { CashExpense } from './cash-expense.entity';
import { CashSettings } from './cash-settings.entity';

@Injectable()
export class CashService {
  constructor(@InjectRepository(CashSettings) private settings: Repository<CashSettings>, @InjectRepository(CashExpense) private expenses: Repository<CashExpense>, @InjectRepository(PairRegistration) private registrations: Repository<PairRegistration>) {}
  async summary() {
    const [settings, expenses, registrations] = await Promise.all([this.getSettings(), this.expenses.find({ order: { createdAt: 'DESC' } }), this.registrations.find({ relations: { payments: true }, order: { createdAt: 'DESC' } })]);
    const incomes = registrations.flatMap((item) => item.payments.filter((payment) => payment.amount > 0).map((payment) => ({ id: payment.id, registrationId: item.id, team: item.localityName, players: payment.players, amount: payment.amount, paidAt: payment.createdAt, concept: payment.kind === 'ADDITIONAL' ? 'Jugadora adicional' : 'Inscripción' }))).sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
    const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0); const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
    return { feePerPlayer: settings.feePerPlayer, incomes, expenses, totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }
  async updateFeePerPlayer(feePerPlayer: number) { const settings = await this.getSettings(); settings.feePerPlayer = feePerPlayer; return this.settings.save(settings); }
  async createExpense(input: { reason: string; quantity: number; unitPrice: number }) { return this.expenses.save(this.expenses.create({ reason: input.reason.trim(), quantity: input.quantity, unitPrice: input.unitPrice, amount: input.quantity * input.unitPrice })); }
  async removeExpense(id: number) { const item = await this.expenses.findOneBy({ id }); if (!item) throw new NotFoundException('Egreso no encontrado'); await this.expenses.remove(item); return { success: true }; }
  private async getSettings() { let settings = await this.settings.findOneBy({ id: 1 }); if (!settings) settings = await this.settings.save(this.settings.create({ id: 1, feePerPlayer: 15000 })); return settings; }
}
