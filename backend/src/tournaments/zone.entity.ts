import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Venue } from '../courts/venue.entity';
import { TournamentCategory } from './tournament-category.entity';

@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn() id: number;
  @Column() tournamentCategoryId: number;
  @ManyToOne(() => TournamentCategory, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tournamentCategoryId' }) tournamentCategory: TournamentCategory;
  @Column() venueId: number;
  @ManyToOne(() => Venue, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'venueId' }) venue: Venue;
  @Column() name: string;
  @Column({ type: 'integer' }) capacity: number;
}
