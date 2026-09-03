import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cash_expenses')
export class CashExpense {
  @PrimaryGeneratedColumn() id: number;
  @Column() reason: string;
  @Column({ type: 'integer' }) quantity: number;
  @Column({ type: 'integer' }) unitPrice: number;
  @Column({ type: 'integer' }) amount: number;
  @CreateDateColumn() createdAt: Date;
}
