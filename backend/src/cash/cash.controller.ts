import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';
import { DirectorGuard } from '../auth/director.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CashService } from './cash.service';

class FeeDto { @IsInt() @Min(0) feePerPlayer: number; }
class MovementDatesDto {
  @IsOptional() @IsIn(['PROJECTED', 'REALIZED']) status?: 'PROJECTED' | 'REALIZED';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) expectedAt?: string | null;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredAt?: string | null;
}
class IncomeDto extends MovementDatesDto {
  @IsString() @MinLength(2) concept: string;
  @IsOptional() @IsString() payer?: string | null;
  @IsInt() @Min(1) @Max(2_147_483_647) amount: number;
}
class ExpenseDto extends MovementDatesDto {
  @IsString() @MinLength(2) reason: string;
  @IsInt() @Min(1) quantity: number;
  @IsInt() @Min(0) unitPrice: number;
}
class UpdateIncomeDto extends PartialType(IncomeDto) {}
class UpdateExpenseDto extends PartialType(ExpenseDto) {}

@Controller('cash')
@UseGuards(JwtAuthGuard, DirectorGuard)
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get() summary() { return this.cash.summary(); }
  @Patch('fee') fee(@Body() dto: FeeDto) { return this.cash.updateFeePerPlayer(dto.feePerPlayer); }

  @Post('incomes') income(@Body() dto: IncomeDto) { return this.cash.createIncome(dto); }
  @Patch('incomes/:id') updateIncome(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIncomeDto) { return this.cash.updateIncome(id, dto); }
  @Delete('incomes/:id') removeIncome(@Param('id', ParseIntPipe) id: number) { return this.cash.removeIncome(id); }

  @Post('expenses') expense(@Body() dto: ExpenseDto) { return this.cash.createExpense(dto); }
  @Patch('expenses/:id') updateExpense(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto) { return this.cash.updateExpense(id, dto); }
  @Delete('expenses/:id') removeExpense(@Param('id', ParseIntPipe) id: number) { return this.cash.removeExpense(id); }
}
