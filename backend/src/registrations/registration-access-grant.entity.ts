import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PairRegistration } from './pair-registration.entity';
import { RegistrationAccessGrantStatus } from './registration.enums';
import { Category } from '../categories/category.entity';
import type { WhatsAppDelivery } from '../whatsapp/whatsapp-delivery.entity';

@Entity('registration_access_grants')
export class RegistrationAccessGrant {
  whatsappDelivery?: WhatsAppDelivery | null;
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  token: string;

  @Column({ type: 'integer' })
  categoryId: number;

  @Column({ type: 'integer', nullable: true })
  localityId: number | null;

  @ManyToOne(() => Category, (category) => category.accessGrants, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column()
  localityName: string;

  @Column()
  provinceName: string;

  @Column()
  clubName: string;

  @Column({ type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactPhone: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: false })
  feeWaived: boolean;

  @Column({ type: 'boolean', default: false })
  paymentDeferredUntilConfirmed: boolean;

  @Column({
    type: 'enum',
    enum: RegistrationAccessGrantStatus,
    enumName: 'registration_access_grant_status',
    default: RegistrationAccessGrantStatus.ACTIVE,
  })
  status: RegistrationAccessGrantStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  consumedAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  whatsappSentAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  whatsappMessageId: string | null;

  @OneToMany(() => PairRegistration, (registration) => registration.accessGrant)
  registrations: PairRegistration[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
