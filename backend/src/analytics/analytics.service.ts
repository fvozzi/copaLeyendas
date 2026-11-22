import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsPageView, type AnalyticsDevice } from './page-view.entity';
import type { RecordPageViewDto } from './analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(@InjectRepository(AnalyticsPageView) private readonly views: Repository<AnalyticsPageView>) {}

  async record(dto: RecordPageViewDto, userAgent = '') {
    if (isBot(userAgent)) return;
    const path = normalizePath(dto.path);
    await this.views.insert({
      path,
      section: sectionForPath(path),
      visitorHash: createHash('sha256').update(dto.visitorId).digest('hex'),
      device: deviceForUserAgent(userAgent),
      referrerHost: referrerHost(dto.referrer),
    });
  }

  async summary(requestedDays?: string) {
    const days = [7, 30, 90].includes(Number(requestedDays)) ? Number(requestedDays) : 30;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const params = [from];
    const [totals] = await this.views.query(`
      SELECT COUNT(*)::int AS "views", COUNT(DISTINCT "visitorHash")::int AS "visitors"
      FROM "analytics_page_views" WHERE "createdAt" >= $1
    `, params);
    const sections = await this.views.query(`
      SELECT "section" AS "label", COUNT(*)::int AS "views", COUNT(DISTINCT "visitorHash")::int AS "visitors"
      FROM "analytics_page_views" WHERE "createdAt" >= $1
      GROUP BY "section" ORDER BY "views" DESC, "section" ASC
    `, params);
    const pages = await this.views.query(`
      SELECT "path" AS "label", COUNT(*)::int AS "views", COUNT(DISTINCT "visitorHash")::int AS "visitors"
      FROM "analytics_page_views" WHERE "createdAt" >= $1
      GROUP BY "path" ORDER BY "views" DESC, "path" ASC LIMIT 12
    `, params);
    const devices = await this.views.query(`
      SELECT "device" AS "label", COUNT(*)::int AS "views"
      FROM "analytics_page_views" WHERE "createdAt" >= $1
      GROUP BY "device" ORDER BY "views" DESC
    `, params);
    const referrers = await this.views.query(`
      SELECT COALESCE("referrerHost", 'Directo') AS "label", COUNT(*)::int AS "views"
      FROM "analytics_page_views" WHERE "createdAt" >= $1
      GROUP BY COALESCE("referrerHost", 'Directo') ORDER BY "views" DESC LIMIT 10
    `, params);
    const daily = await this.views.query(`
      SELECT TO_CHAR(DATE("createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires'), 'YYYY-MM-DD') AS "date", COUNT(*)::int AS "views", COUNT(DISTINCT "visitorHash")::int AS "visitors"
      FROM "analytics_page_views" WHERE "createdAt" >= $1
      GROUP BY DATE("createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires') ORDER BY "date" ASC
    `, params);
    return { days, from: from.toISOString(), views: totals?.views ?? 0, visitors: totals?.visitors ?? 0, sections, pages, devices, referrers, daily };
  }
}

function normalizePath(value: string) {
  const path = value.split(/[?#]/, 1)[0].replace(/\/{2,}/g, '/');
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

function sectionForPath(path: string) {
  if (path === '/') return 'Inicio';
  if (path.startsWith('/torneos/')) return 'Edición de torneo';
  if (path === '/secciones/torneos') return 'Torneos';
  if (path === '/secciones/historias') return 'Historias';
  if (path === '/museo-pelotari') return 'Museo Pelotari';
  if (path === '/inscripcion') return 'Inscripción';
  if (path === '/cuil') return 'CUIL';
  if (path.startsWith('/post/')) return 'Publicaciones';
  return 'Otras páginas';
}

function deviceForUserAgent(userAgent: string): AnalyticsDevice {
  if (/ipad|tablet|kindle|silk|playbook/i.test(userAgent)) return 'TABLET';
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'MOBILE';
  return 'DESKTOP';
}

function isBot(userAgent: string) {
  return /bot|crawler|spider|slurp|headless|lighthouse|preview/i.test(userAgent);
}

function referrerHost(value?: string) {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}
