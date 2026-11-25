import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CommunityCourt } from './community-court.entity';

@Entity('community_court_photos')
export class CommunityCourtPhoto {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) courtId: number;
  @ManyToOne(() => CommunityCourt, (court) => court.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courtId' }) court: CommunityCourt;
  @Column({ type: 'varchar', length: 80 }) storedName: string;
  @Column({ type: 'varchar', length: 220 }) originalName: string;
  @Column({ type: 'varchar', length: 80 }) mimeType: string;
  @Column({ type: 'smallint' }) sortOrder: number;
}
