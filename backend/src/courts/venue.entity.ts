import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { VenueLeaderAssignment } from './venue-leader-assignment.entity';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) address: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ type: 'varchar', nullable: true }) provinceName: string | null;
  @Column({ type: 'time', default: '10:00' }) startsAt: string;
  @Column({ type: 'integer', default: 40 }) matchDurationMinutes: number;
  @Column({ type: 'integer', default: 16 }) matchesPerDay: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @OneToMany(() => VenueLeaderAssignment, (assignment) => assignment.venue) assignments: VenueLeaderAssignment[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
