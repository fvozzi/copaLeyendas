import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CommunityCourtPlayerGroup } from './community-court-player-group.entity';
import { CommunityCourtPhoto } from './community-court-photo.entity';

export enum CommunityCourtType { TRINQUET = 'TRINQUET', FRONTON = 'FRONTON' }
export enum TrinquetShareMaterial { WOOD = 'WOOD', MASONRY = 'MASONRY', OTHER = 'OTHER' }
export enum FrontonWallOrientation { LEFT_LONG = 'LEFT_LONG', RIGHT_LONG = 'RIGHT_LONG' }
export enum FrontonBackType { REBOUND = 'REBOUND', FREE_LIFT = 'FREE_LIFT' }
export enum CommunityFrontisFinish { HARD = 'HARD', MARBLE = 'MARBLE' }
export enum CommunityCourtColor { WHITE = 'WHITE', BLUE = 'BLUE', GREEN = 'GREEN', GRAY = 'GRAY' }

@Entity('community_courts')
export class CommunityCourt {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 140 }) name: string;
  @Column({ type: 'varchar', length: 80 }) country: string;
  @Column({ type: 'varchar', length: 120 }) province: string;
  @Column({ type: 'varchar', length: 120 }) locality: string;
  @Column({ type: 'varchar', length: 220, nullable: true }) address: string | null;
  @Column({ type: 'varchar', length: 12, nullable: true }) courtType: CommunityCourtType | null;
  @Column({ type: 'varchar', length: 12, nullable: true }) trinquetShareMaterial: TrinquetShareMaterial | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) trinquetShareMaterialOther: string | null;
  @Column({ type: 'varchar', length: 12, nullable: true }) frontonWallOrientation: FrontonWallOrientation | null;
  @Column({ type: 'boolean', nullable: true }) frontonHasCacerola: boolean | null;
  @Column({ type: 'varchar', length: 12, nullable: true }) frontonBackType: FrontonBackType | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) frontonReboundMaterial: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) frontisFinish: CommunityFrontisFinish | null;
  @Column({ type: 'varchar', length: 10, nullable: true }) courtColor: CommunityCourtColor | null;
  @Column({ type: 'text', nullable: true }) history: string | null;
  @Column({ type: 'boolean', default: false }) hasSchool: boolean;
  @Column({ type: 'double precision' }) latitude: number;
  @Column({ type: 'double precision' }) longitude: number;
  @Column({ type: 'real', nullable: true }) lengthMeters: number | null;
  @Column({ type: 'real', nullable: true }) widthMeters: number | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @OneToMany(() => CommunityCourtPlayerGroup, (group) => group.court, { cascade: true }) playerGroups: CommunityCourtPlayerGroup[];
  @OneToMany(() => CommunityCourtPhoto, (photo) => photo.court, { cascade: true }) photos: CommunityCourtPhoto[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
