import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { CashController } from './cash.controller';
import { CashExpense } from './cash-expense.entity';
import { CashIncome } from './cash-income.entity';
import { CashSettings } from './cash-settings.entity';
import { CashService } from './cash.service';
@Module({ imports: [TypeOrmModule.forFeature([CashSettings, CashExpense, CashIncome, PairRegistration, Tournament])], controllers: [CashController], providers: [CashService] }) export class CashModule {}
