import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ActivityLog, type ActivityLevel, type ActivitySource } from './activity-log.entity';

export type ActivityRecord = {
  requestId: string;
  level: ActivityLevel;
  source: ActivitySource;
  method: string;
  path: string;
  message: string;
  statusCode: number;
  durationMs: number;
  actorUserId: number | null;
  actorName: string | null;
  detail: string | null;
};

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(@InjectRepository(ActivityLog) private readonly logs: Repository<ActivityLog>) {}

  record(entry: ActivityRecord) {
    void this.logs.insert(entry).catch((error: unknown) => {
      this.logger.error(`No se pudo guardar actividad requestId=${entry.requestId}: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  async list(filters: { page?: string; pageSize?: string; level?: string; method?: string; search?: string }) {
    const page = positiveInteger(filters.page, 1);
    const pageSize = Math.min(200, positiveInteger(filters.pageSize, 50));
    const qb = this.logs.createQueryBuilder('activity').orderBy('activity.createdAt', 'DESC').addOrderBy('activity.id', 'DESC');
    if (['INFO', 'WARNING', 'ERROR'].includes(filters.level ?? '')) qb.andWhere('activity.level = :level', { level: filters.level });
    if (['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(filters.method ?? '')) qb.andWhere('activity.method = :method', { method: filters.method });
    const search = filters.search?.trim().toLowerCase();
    if (search) {
      qb.andWhere(new Brackets((where) => where
        .where('LOWER(activity.message) LIKE :search', { search: `%${search}%` })
        .orWhere('LOWER(activity.path) LIKE :search', { search: `%${search}%` })
        .orWhere('LOWER(COALESCE(activity.actorName, \'\')) LIKE :search', { search: `%${search}%` })
        .orWhere('LOWER(activity.requestId::text) LIKE :search', { search: `%${search}%` })));
    }
    const [items, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
