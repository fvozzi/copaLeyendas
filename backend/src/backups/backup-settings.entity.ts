import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('backup_settings')
export class BackupSettings {
  @PrimaryColumn({ type: 'integer', default: 1 }) id: number;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @Column({ type: 'integer', default: 30 }) retentionCount: number;
  @Column({ type: 'integer', default: 3 }) scheduleHour: number;
  @Column({ type: 'integer', default: 0 }) scheduleMinute: number;
}
