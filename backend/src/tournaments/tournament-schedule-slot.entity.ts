import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TournamentCategory } from './tournament-category.entity';
import { Tournament } from './tournament.entity';

@Entity('tournament_schedule_slots')
export class TournamentScheduleSlot {
  @PrimaryGeneratedColumn() id: number;
  @Column() tournamentId: number;
  @ManyToOne(() => Tournament, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tournamentId' }) tournament: Tournament;
  @Column() tournamentCategoryId: number;
  @ManyToOne(() => TournamentCategory, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tournamentCategoryId' }) tournamentCategory: TournamentCategory;
  @Column() zoneName: string;
  @Column() matchOrder: number;
  @Column() sequence: number;
  @Column({ type: 'timestamp with time zone', nullable: true }) scheduledAt: Date | null;
}
