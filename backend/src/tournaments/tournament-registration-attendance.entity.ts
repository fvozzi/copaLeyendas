import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { Tournament } from './tournament.entity';

@Entity('tournament_registration_attendance')
@Unique(['tournamentId', 'registrationId'])
export class TournamentRegistrationAttendance {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) tournamentId: number;
  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tournamentId' }) tournament: Tournament;
  @Column({ type: 'integer' }) registrationId: number;
  @ManyToOne(() => PairRegistration, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'registrationId' }) registration: PairRegistration;
  @Column({ type: 'boolean', default: true }) present: boolean;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
