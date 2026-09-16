import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PairRegistration } from './pair-registration.entity';

@Entity('registration_payments')
export class RegistrationPayment {
  @PrimaryGeneratedColumn() id: number;
  @Column() registrationId: number;
  @ManyToOne(() => PairRegistration, (registration) => registration.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registrationId' }) registration: PairRegistration;
  @Column({ type: 'varchar' }) kind: 'INITIAL' | 'ADDITIONAL' | 'REPLACEMENT';
  @Column() players: number;
  @Column() rosterSize: number;
  @Column() amount: number;
  @Column() storedName: string;
  @Column() originalName: string;
  @Column() mimeType: string;
  @Column({ type: 'integer', nullable: true }) sizeBytes: number | null;
  @CreateDateColumn() createdAt: Date;
}
