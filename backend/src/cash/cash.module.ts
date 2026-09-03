import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { CashController } from './cash.controller';
import { CashExpense } from './cash-expense.entity';
import { CashSettings } from './cash-settings.entity';
import { CashService } from './cash.service';
@Module({ imports: [TypeOrmModule.forFeature([CashSettings, CashExpense, PairRegistration])], controllers: [CashController], providers: [CashService] }) export class CashModule {}
