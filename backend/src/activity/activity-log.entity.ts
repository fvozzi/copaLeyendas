import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ActivityLevel = 'INFO' | 'WARNING' | 'ERROR';
export type ActivitySource = 'PUBLIC' | 'ADMIN';

@Entity('activity_logs')
@Index(['createdAt'])
@Index(['level', 'createdAt'])
export class ActivityLog {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'uuid', unique: true }) requestId: string;
  @Column({ type: 'varchar', length: 10 }) level: ActivityLevel;
  @Column({ type: 'varchar', length: 10 }) source: ActivitySource;
  @Column({ type: 'varchar', length: 10 }) method: string;
  @Column({ type: 'varchar', length: 300 }) path: string;
  @Column({ type: 'varchar', length: 300 }) message: string;
  @Column({ type: 'integer' }) statusCode: number;
  @Column({ type: 'integer' }) durationMs: number;
  @Column({ type: 'integer', nullable: true }) actorUserId: number | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) actorName: string | null;
  @Column({ type: 'text', nullable: true }) detail: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
