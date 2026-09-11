import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupSettings } from './backup-settings.entity';
import { DatabaseBackup } from './database-backup.entity';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

@Module({ imports: [TypeOrmModule.forFeature([BackupSettings, DatabaseBackup])], controllers: [BackupsController], providers: [BackupsService] })
export class BackupsModule {}
