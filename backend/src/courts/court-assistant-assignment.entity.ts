import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../auth/user.entity';
import { Court } from './court.entity';

@Entity('court_assistant_assignments')
@Unique(['courtId', 'userId'])
export class CourtAssistantAssignment {
  @PrimaryGeneratedColumn() id: number;

  @Column() courtId: number;
  @ManyToOne(() => Court, (court) => court.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courtId' })
  court: Court;

  @Column() userId: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
