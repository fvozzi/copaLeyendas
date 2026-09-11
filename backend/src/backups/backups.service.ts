import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync } from 'node:fs';
import { chmod, lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { DataSource, MoreThanOrEqual, QueryRunner, Repository } from 'typeorm';
import { BackupSettings } from './backup-settings.entity';
import { BackupTrigger, DatabaseBackup } from './database-backup.entity';
import { UpdateBackupSettingsDto } from './update-backup-settings.dto';
import { runPgDump } from './pg-dump';

const LOCK_ID = 185704291;
export const BACKUP_TIMEZONE = 'America/Argentina/Buenos_Aires';
const FILE_PATTERN = /^copa-leyendas-[\dTZ-]+-[a-f\d-]+\.dump$/;

export function scheduledTime(now: Date, hour: number, minute: number) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BACKUP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (key: string) => parts.find((item) => item.type === key)!.value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`);
}

@Injectable()
export class BackupsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupsService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private stopping = false;
  private job?: Promise<void>;
  private abort?: AbortController;

  constructor(
    @InjectRepository(BackupSettings) private readonly settings: Repository<BackupSettings>,
    @InjectRepository(DatabaseBackup) private readonly backups: Repository<DatabaseBackup>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.checkSchedule(), 60_000);
    this.timer.unref();
    void this.checkSchedule();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.abort?.abort();
    await this.job;
  }

  private async getSettings() {
    await this.settings.createQueryBuilder().insert().values({ id: 1, enabled: true, retentionCount: 30, scheduleHour: 3, scheduleMinute: 0 }).orIgnore().execute();
    return this.settings.findOneByOrFail({ id: 1 });
  }

  async overview() {
    const [settings, backups] = await Promise.all([this.getSettings(), this.backups.find({ order: { startedAt: 'DESC', id: 'DESC' }, take: 400 })]);
    return {
      ...settings, timezone: BACKUP_TIMEZONE,
      backups: await Promise.all(backups.map(async (backup) => ({
        ...backup, fileSizeBytes: backup.fileSizeBytes ? Number(backup.fileSizeBytes) : null,
        canDownload: backup.status === 'SUCCESS' && await this.fileAvailable(backup.fileName),
      }))),
    };
  }

  async updateSettings(dto: UpdateBackupSettingsDto) {
    await this.getSettings();
    await this.settings.update(1, { enabled: dto.enabled, retentionCount: dto.retentionCount, scheduleHour: dto.scheduleHour, scheduleMinute: dto.scheduleMinute });
    return this.overview();
  }

  private storageDir() {
    const configured = this.config.get<string>('BACKUP_STORAGE_DIR')?.trim();
    if (configured) return resolve(configured);
    const shared = resolve(process.cwd(), '..', '..', 'shared');
    return existsSync(shared) ? join(shared, 'backups') : resolve(process.cwd(), 'storage', 'backups');
  }

  private filePath(name: string) {
    if (!FILE_PATTERN.test(name)) throw new NotFoundException('Nombre de backup invalido');
    return join(this.storageDir(), name);
  }

  private async fileAvailable(name: string | null) {
    if (!name) return false;
    try { return (await lstat(this.filePath(name))).isFile(); } catch { return false; }
  }

  async download(id: number) {
    const backup = await this.backups.findOneBy({ id });
    if (!backup || backup.status !== 'SUCCESS' || !backup.fileName || !await this.fileAvailable(backup.fileName)) {
      throw new NotFoundException('El backup no esta disponible para descargar');
    }
    return { fileName: backup.fileName, stream: new StreamableFile(createReadStream(this.filePath(backup.fileName))) };
  }

  async checkSchedule() {
    if (this.stopping || this.busy) return;
    try { await this.start('SCHEDULED', null); }
    catch (error) { if (!(error instanceof ConflictException)) this.logger.error(this.errorMessage(error)); }
  }

  async start(triggerType: BackupTrigger, createdByName: string | null) {
    if (this.stopping || this.busy) throw new ConflictException('Ya hay un backup en curso');
    this.busy = true;
    const runner = this.dataSource.createQueryRunner();
    let acquired = false;
    let handedOff = false;
    try {
      await runner.connect();
      const [lock] = await runner.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_ID]);
      acquired = Boolean(lock.locked);
      if (!acquired) throw new ConflictException('Ya hay un backup en curso');
      // The lock uses this dedicated connection until pg_dump exits, including across multiple workers.
      await this.backups.update({ status: 'RUNNING' }, { status: 'FAILED', finishedAt: new Date(), errorMessage: 'El proceso anterior se interrumpio. Genera un nuevo backup.' });
      const settings = await this.getSettings();
      const now = new Date();
      if (triggerType === 'SCHEDULED') {
        const due = scheduledTime(now, settings.scheduleHour, settings.scheduleMinute);
        if (!settings.enabled || now < due) return null;
        const dayStart = scheduledTime(now, 0, 0);
        if (await this.backups.countBy({ triggerType: 'SCHEDULED', startedAt: MoreThanOrEqual(dayStart) })) return null;
      }
      if (this.stopping) return null;
      const backup = await this.backups.save(this.backups.create({ triggerType, createdByName, status: 'RUNNING', startedAt: now, finishedAt: null, fileName: null, fileSizeBytes: null, errorMessage: null }));
      this.abort = new AbortController();
      this.job = this.execute(backup, settings.retentionCount, this.abort.signal)
        .catch((error) => this.logger.error(this.errorMessage(error)))
        .finally(async () => {
          try { await this.release(runner); }
          catch { this.logger.error('No se pudo cerrar la conexion del backup'); }
          finally { this.busy = false; this.abort = undefined; }
        });
      handedOff = true;
      return { id: backup.id, status: 'RUNNING' as const };
    } finally {
      if (!handedOff) {
        try { if (acquired) await this.release(runner); else await runner.release(); }
        finally { this.busy = false; }
      }
    }
  }

  private async release(runner: QueryRunner) {
    try { await runner.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]); }
    finally { await runner.release(); }
  }

  private errorMessage(error: unknown) {
    let message = error instanceof Error ? error.message : 'No se pudo completar el backup';
    const password = this.config.get<string>('DB_PASSWORD');
    if (password) message = message.split(password).join('[oculto]');
    if (message.includes('ENOENT')) return 'No se encontro pg_dump. Instala el cliente PostgreSQL o configura PG_DUMP_BINARY.';
    return message.slice(0, 2000);
  }

  private async execute(backup: DatabaseBackup, retentionCount: number, signal: AbortSignal) {
    const name = `copa-leyendas-${backup.startedAt.toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.dump`;
    const path = this.filePath(name);
    const partial = `${path}.partial`;
    try {
      await mkdir(this.storageDir(), { recursive: true, mode: 0o700 });
      const handle = await open(partial, 'wx', 0o600);
      await handle.close();
      await runPgDump({
        binary: this.config.get<string>('PG_DUMP_BINARY')?.trim() || 'pg_dump',
        host: this.config.getOrThrow<string>('DB_HOST'), port: this.config.get<string>('DB_PORT', '5432'),
        username: this.config.getOrThrow<string>('DB_USER'), password: this.config.getOrThrow<string>('DB_PASSWORD'),
        database: this.config.getOrThrow<string>('DB_NAME'), outputPath: partial, signal,
      });
      const dump = await open(partial, 'r');
      try {
        const header = Buffer.alloc(5);
        await dump.read(header, 0, 5, 0);
        if (header.toString() !== 'PGDMP') throw new Error('pg_dump no genero un respaldo valido');
      } finally { await dump.close(); }
      const stats = await lstat(partial);
      await chmod(partial, 0o600);
      await rename(partial, path);
      await this.backups.update(backup.id, { status: 'SUCCESS', fileName: name, fileSizeBytes: String(stats.size), finishedAt: new Date(), errorMessage: null });
    } catch (error) {
      await unlink(partial).catch(() => undefined);
      // A renamed file may remain if persisting metadata failed; never advertise it as downloadable.
      await this.backups.update(backup.id, { status: 'FAILED', finishedAt: new Date(), errorMessage: this.errorMessage(error) });
      return;
    }
    // Retention failure must not turn a valid backup into a failed one.
    try { await this.prune(retentionCount); }
    catch (error) { this.logger.warn(`No se pudieron limpiar copias antiguas: ${this.errorMessage(error)}`); }
  }

  private async prune(retentionCount: number) {
    const copies = await this.backups.find({ where: { status: 'SUCCESS' }, order: { startedAt: 'DESC', id: 'DESC' } });
    let retained = 0;
    for (const backup of copies) {
      if (!backup.fileName) continue;
      if (await this.fileAvailable(backup.fileName) && ++retained <= retentionCount) continue;
      const path = this.filePath(backup.fileName);
      await unlink(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
      await this.backups.delete(backup.id);
    }
  }
}
