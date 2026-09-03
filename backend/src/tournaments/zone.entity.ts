import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Court } from '../courts/court.entity';
import { TournamentCategory } from './tournament-category.entity';

@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn() id: number;
  @Column() tournamentCategoryId: number;
  @ManyToOne(() => TournamentCategory, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tournamentCategoryId' }) tournamentCategory: TournamentCategory;
  @Column() courtId: number;
  @ManyToOne(() => Court, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'courtId' }) court: Court;
  @Column() name: string;
  @Column({ type: 'integer' }) capacity: number;
}
