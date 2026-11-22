import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('stores only an anonymous visitor hash and coarse device information', async () => {
    const repository = { insert: vi.fn().mockResolvedValue(undefined), query: vi.fn() };
    const service = new AnalyticsService(repository as never);
    const visitorId = '3f9d65d0-d0cc-4de9-a18c-2a561674a955';

    await service.record({ path: '/torneos/femme-2026/?tab=fotos', visitorId, referrer: 'https://www.instagram.com/story/123' }, 'Mozilla/5.0 (iPhone; Mobile)');

    expect(repository.insert).toHaveBeenCalledWith(expect.objectContaining({
      path: '/torneos/femme-2026', section: 'Edición de torneo', device: 'MOBILE', referrerHost: 'instagram.com', visitorHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(JSON.stringify(repository.insert.mock.calls)).not.toContain(visitorId);
  });

  it('ignores automated crawlers', async () => {
    const repository = { insert: vi.fn(), query: vi.fn() };
    const service = new AnalyticsService(repository as never);
    await service.record({ path: '/', visitorId: '3f9d65d0-d0cc-4de9-a18c-2a561674a955' }, 'Googlebot/2.1');
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('returns the selected reporting period and all dashboard dimensions', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ views: 20, visitors: 8 }])
      .mockResolvedValueOnce([{ label: 'Historias', views: 9, visitors: 5 }])
      .mockResolvedValueOnce([{ label: '/secciones/historias', views: 9, visitors: 5 }])
      .mockResolvedValueOnce([{ label: 'MOBILE', views: 12 }])
      .mockResolvedValueOnce([{ label: 'Directo', views: 14 }])
      .mockResolvedValueOnce([{ date: '2026-11-22', views: 20, visitors: 8 }]);
    const service = new AnalyticsService({ insert: vi.fn(), query } as never);

    await expect(service.summary('7')).resolves.toMatchObject({
      days: 7, views: 20, visitors: 8,
      sections: [{ label: 'Historias', views: 9, visitors: 5 }],
      devices: [{ label: 'MOBILE', views: 12 }],
    });
    expect(query).toHaveBeenCalledTimes(6);
  });
});
