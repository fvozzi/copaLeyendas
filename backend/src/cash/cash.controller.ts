import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsString, Min, MinLength } from 'class-validator';
import { DirectorGuard } from '../auth/director.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CashService } from './cash.service';
class FeeDto { @IsInt() @Min(0) feePerPlayer: number; }
class ExpenseDto { @IsString() @MinLength(2) reason: string; @IsInt() @Min(1) quantity: number; @IsInt() @Min(0) unitPrice: number; }
@Controller('cash') @UseGuards(JwtAuthGuard, DirectorGuard)
export class CashController { constructor(private readonly cash: CashService) {} @Get() summary() { return this.cash.summary(); } @Patch('fee') fee(@Body() dto: FeeDto) { return this.cash.updateFeePerPlayer(dto.feePerPlayer); } @Post('expenses') expense(@Body() dto: ExpenseDto) { return this.cash.createExpense(dto); } @Delete('expenses/:id') remove(@Param('id', ParseIntPipe) id: number) { return this.cash.removeExpense(id); } }
