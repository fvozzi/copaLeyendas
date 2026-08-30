import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PairRegistration } from './pair-registration.entity';
import { PairCategory, RegistrationAccessGrantStatus } from './registration.enums';

@Entity('registration_access_grants')
export class RegistrationAccessGrant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: PairCategory,
    enumName: 'pair_category',
  })
  category: PairCategory;

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

  @Column({
    type: 'enum',
    enum: RegistrationAccessGrantStatus,
    enumName: 'registration_access_grant_status',
    default: RegistrationAccessGrantStatus.ACTIVE,
  })
  status: RegistrationAccessGrantStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  consumedAt: Date | null;

  @OneToMany(() => PairRegistration, (registration) => registration.accessGrant)
  registrations: PairRegistration[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
