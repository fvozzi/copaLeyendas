import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
export type BackupTrigger = 'MANUAL' | 'SCHEDULED';
export type BackupStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

@Entity('database_backups')
export class DatabaseBackup {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar' }) triggerType: BackupTrigger;
  @Column({ type: 'varchar' }) status: BackupStatus;
  @Column({ type: 'varchar', nullable: true }) createdByName: string | null;
  @Column({ type: 'varchar', nullable: true }) fileName: string | null;
  @Column({ type: 'bigint', nullable: true }) fileSizeBytes: string | null;
  @Column({ type: 'text', nullable: true }) errorMessage: string | null;
  @Column({ type: 'timestamptz' }) startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null;
}
