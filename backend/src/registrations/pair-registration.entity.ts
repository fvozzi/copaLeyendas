import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RegistrationAccessGrant } from './registration-access-grant.entity';
import {
  HeardAboutSource,
  PairCategory,
  RegistrationStatus,
  ShirtSize,
} from './registration.enums';

@Entity('pair_registrations')
export class PairRegistration {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  accessGrantId: number;

  @ManyToOne(() => RegistrationAccessGrant, (grant) => grant.registrations, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'accessGrantId' })
  accessGrant: RegistrationAccessGrant;

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

  @Column({
    type: 'enum',
    enum: HeardAboutSource,
    enumName: 'heard_about_source',
  })
  heardAboutSource: HeardAboutSource;

  @Column({ type: 'varchar', nullable: true })
  heardAboutOtherText: string | null;

  @Column({ type: 'boolean', default: false })
  tournamentAvailabilityConfirmed: boolean;

  @Column()
  representingText: string;

  @Column({ type: 'varchar', nullable: true })
  contactEmail: string | null;

  @Column({ type: 'boolean', default: false })
  feeWaived: boolean;

  @Column()
  playerOneName: string;

  @Column()
  playerOneDni: string;

  @Column({ type: 'date' })
  playerOneBirthDate: string;

  @Column()
  playerOnePhone: string;

  @Column({ type: 'varchar', nullable: true })
  playerOneInstagram: string | null;

  @Column({
    type: 'enum',
    enum: ShirtSize,
    enumName: 'shirt_size',
  })
  playerOneShirtSize: ShirtSize;

  @Column({ type: 'boolean', default: false })
  playerOneHasCommercialAgreement: boolean;

  @Column({ type: 'text', nullable: true })
  playerOneCommercialAgreementDetails: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerOnePhotoStoredName: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerOnePhotoOriginalName: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerOnePhotoMimeType: string | null;

  @Column({ type: 'integer', nullable: true })
  playerOnePhotoSizeBytes: number | null;

  @Column()
  playerTwoName: string;

  @Column()
  playerTwoDni: string;

  @Column({ type: 'date' })
  playerTwoBirthDate: string;

  @Column()
  playerTwoPhone: string;

  @Column({ type: 'varchar', nullable: true })
  playerTwoInstagram: string | null;

  @Column({
    type: 'enum',
    enum: ShirtSize,
    enumName: 'shirt_size',
  })
  playerTwoShirtSize: ShirtSize;

  @Column({ type: 'boolean', default: false })
  playerTwoHasCommercialAgreement: boolean;

  @Column({ type: 'text', nullable: true })
  playerTwoCommercialAgreementDetails: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerTwoPhotoStoredName: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerTwoPhotoOriginalName: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerTwoPhotoMimeType: string | null;

  @Column({ type: 'integer', nullable: true })
  playerTwoPhotoSizeBytes: number | null;

  @Column({ type: 'varchar', nullable: true })
  playerThreeName: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerThreeDni: string | null;

  @Column({ type: 'date', nullable: true })
  playerThreeBirthDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerThreePhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerThreeInstagram: string | null;

  @Column({
    type: 'enum',
    enum: ShirtSize,
    enumName: 'shirt_size',
    nullable: true,
  })
  playerThreeShirtSize: ShirtSize | null;

  @Column({ type: 'boolean', default: false })
  playerThreeHasCommercialAgreement: boolean;

  @Column({ type: 'text', nullable: true })
  playerThreeCommercialAgreementDetails: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerThreePhotoStoredName: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerThreePhotoOriginalName: string | null;

  @Column({ type: 'varchar', nullable: true })
  playerThreePhotoMimeType: string | null;

  @Column({ type: 'integer', nullable: true })
  playerThreePhotoSizeBytes: number | null;

  @Column({ type: 'varchar', nullable: true })
  substituteName: string | null;

  @Column({ type: 'varchar', nullable: true })
  substituteDni: string | null;

  @Column({ type: 'date', nullable: true })
  substituteBirthDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  substitutePhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  substituteInstagram: string | null;

  @Column({
    type: 'enum',
    enum: ShirtSize,
    enumName: 'shirt_size',
    nullable: true,
  })
  substituteShirtSize: ShirtSize | null;

  @Column({ type: 'varchar', nullable: true })
  paymentProofStoredName: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentProofOriginalName: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentProofMimeType: string | null;

  @Column({ type: 'integer', nullable: true })
  paymentProofSizeBytes: number | null;

  @Column({
    type: 'enum',
    enum: RegistrationStatus,
    enumName: 'registration_status',
    default: RegistrationStatus.RECEIVED,
  })
  status: RegistrationStatus;

  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
