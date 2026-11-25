import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CommunityCourt } from './community-court.entity';

export enum CommunityPlayerGender {
  FEMALE = 'FEMALE',
  MALE = 'MALE',
  MIXED = 'MIXED',
  OTHER = 'OTHER',
}

@Entity('community_court_player_groups')
export class CommunityCourtPlayerGroup {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) courtId: number;
  @ManyToOne(() => CommunityCourt, (court) => court.playerGroups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courtId' })
  court: CommunityCourt;
  @Column({ type: 'varchar', length: 12 }) gender: CommunityPlayerGender;
  @Column({ type: 'smallint', nullable: true }) minAge: number | null;
  @Column({ type: 'smallint', nullable: true }) maxAge: number | null;
  @Column({ type: 'integer' }) playerCount: number;
}
