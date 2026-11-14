import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../auth/user.entity';
import { Venue } from './venue.entity';

@Entity('venue_leader_assignments')
@Unique(['venueId', 'userId'])
export class VenueLeaderAssignment {
  @PrimaryGeneratedColumn() id: number;

  @Column() venueId: number;
  @ManyToOne(() => Venue, (venue) => venue.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;

  @Column() userId: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
