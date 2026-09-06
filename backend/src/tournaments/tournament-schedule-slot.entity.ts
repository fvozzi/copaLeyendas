import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TournamentCategory } from './tournament-category.entity';
import { Tournament } from './tournament.entity';
import { Court } from '../courts/court.entity';

@Entity('tournament_schedule_slots')
export class TournamentScheduleSlot {
  @PrimaryGeneratedColumn() id: number;
  @Column() tournamentId: number;
  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tournamentId' }) tournament: Tournament;
  @Column() tournamentCategoryId: number;
  @ManyToOne(() => TournamentCategory, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tournamentCategoryId' }) tournamentCategory: TournamentCategory;
  @Column() zoneName: string;
  @Column() matchOrder: number;
  @Column({ default: 'ZONE' }) stage: string;
  @Column() sequence: number;
  @Column({ nullable: true }) courtId: number | null;
  @ManyToOne(() => Court, { onDelete: 'SET NULL', nullable: true }) @JoinColumn({ name: 'courtId' }) court: Court | null;
  @Column({ type: 'timestamp with time zone', nullable: true }) scheduledAt: Date | null;
}
