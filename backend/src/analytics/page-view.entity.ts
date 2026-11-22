import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AnalyticsDevice = 'MOBILE' | 'TABLET' | 'DESKTOP';

@Entity('analytics_page_views')
@Index(['createdAt'])
@Index(['path', 'createdAt'])
@Index(['section', 'createdAt'])
@Index(['visitorHash', 'createdAt'])
export class AnalyticsPageView {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 300 }) path: string;
  @Column({ type: 'varchar', length: 80 }) section: string;
  @Column({ type: 'char', length: 64 }) visitorHash: string;
  @Column({ type: 'varchar', length: 10 }) device: AnalyticsDevice;
  @Column({ type: 'varchar', length: 200, nullable: true }) referrerHost: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
