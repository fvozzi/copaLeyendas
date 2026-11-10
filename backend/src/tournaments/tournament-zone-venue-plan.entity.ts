import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Venue } from '../courts/venue.entity';
import { TournamentCategory } from './tournament-category.entity';

@Entity('tournament_zone_venue_plans')
@Unique(['tournamentCategoryId', 'zoneIndex'])
export class TournamentZoneVenuePlan {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) tournamentCategoryId: number;
  @ManyToOne(() => TournamentCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentCategoryId' }) tournamentCategory: TournamentCategory;
  @Column({ type: 'integer' }) zoneIndex: number;
  @Column({ type: 'integer' }) venueId: number;
  @ManyToOne(() => Venue, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'venueId' }) venue: Venue;
  @Column({ type: 'boolean', default: false }) directorAssigned: boolean;
}
