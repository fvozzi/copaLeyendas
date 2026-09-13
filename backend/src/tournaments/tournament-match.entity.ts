import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { MatchStatus, ParticipantSource } from './tournament.enums';
import { Zone } from './zone.entity';

@Entity('tournament_matches')
export class TournamentMatch {
  @PrimaryGeneratedColumn() id: number;
  @OneToOne(() => TournamentScheduleSlot, (slot) => slot.match) scheduleSlot: TournamentScheduleSlot | null;
  @Column({ type: 'integer', nullable: true }) zoneId: number | null;
  @ManyToOne(() => Zone, { onDelete: 'CASCADE', nullable: true }) @JoinColumn({ name: 'zoneId' }) zone: Zone | null;
  @Column({ type: 'integer', nullable: true }) homeQualifierZoneId: number | null;
  @Column({ type: 'integer', nullable: true }) homeQualifierRank: number | null;
  @Column({ type: 'integer', nullable: true }) awayQualifierZoneId: number | null;
  @Column({ type: 'integer', nullable: true }) awayQualifierRank: number | null;
  @Column() matchOrder: number;
  @Column({ type: 'enum', enum: MatchStatus, enumName: 'match_status', default: MatchStatus.DRAFT }) status: MatchStatus;
  @Column({ type: 'integer', nullable: true }) homeRegistrationId: number | null;
  @ManyToOne(() => PairRegistration, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'homeRegistrationId' }) homeRegistration: PairRegistration | null;
  @Column({ type: 'integer', nullable: true }) awayRegistrationId: number | null;
  @ManyToOne(() => PairRegistration, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'awayRegistrationId' }) awayRegistration: PairRegistration | null;
  @Column({ type: 'enum', enum: ParticipantSource, enumName: 'participant_source', default: ParticipantSource.DIRECT }) homeSource: ParticipantSource;
  @Column({ type: 'integer', nullable: true }) homeSourceMatchId: number | null;
  @Column({ type: 'enum', enum: ParticipantSource, enumName: 'participant_source', default: ParticipantSource.DIRECT }) awaySource: ParticipantSource;
  @Column({ type: 'integer', nullable: true }) awaySourceMatchId: number | null;
  @Column({ type: 'integer', nullable: true }) homeScore: number | null;
  @Column({ type: 'integer', nullable: true }) awayScore: number | null;
  @Column({ type: 'integer', nullable: true }) winnerRegistrationId: number | null;
  @Column({ type: 'timestamp with time zone', nullable: true }) scheduledAt: Date | null;
}
