import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('cash_settings')
export class CashSettings {
  @PrimaryColumn({ default: 1 }) id: number;
  @Column({ type: 'integer', default: 15000 }) feePerPlayer: number;
}
