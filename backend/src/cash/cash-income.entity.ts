import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cash_incomes')
export class CashIncome {
  @PrimaryGeneratedColumn() id: number;
  @Column() concept: string;
  @Column({ type: 'varchar', nullable: true }) payer: string | null;
  @Column({ type: 'integer' }) amount: number;
  @Column({ type: 'varchar', default: 'PROJECTED' }) status: 'PROJECTED' | 'REALIZED';
  @Column({ type: 'date', nullable: true }) expectedAt: string | null;
  @Column({ type: 'date', nullable: true }) occurredAt: string | null;
  @CreateDateColumn() createdAt: Date;
}
