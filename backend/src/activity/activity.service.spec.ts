import { describe, expect, it, vi } from 'vitest';
import { ActivityService } from './activity.service';

describe('ActivityService', () => {
  it('searches UUID request codes through a portable PostgreSQL text cast', async () => {
    const nested = { where: vi.fn().mockReturnThis(), orWhere: vi.fn().mockReturnThis() };
    const qb = {
      orderBy: vi.fn().mockReturnThis(), addOrderBy: vi.fn().mockReturnThis(),
      andWhere: vi.fn((condition) => {
        if (typeof condition === 'object' && condition && 'whereFactory' in condition) {
          (condition as { whereFactory: (builder: typeof nested) => void }).whereFactory(nested);
        }
        return qb;
      }),
      skip: vi.fn().mockReturnThis(), take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };
    const service = new ActivityService({ createQueryBuilder: vi.fn(() => qb) } as never);
    await service.list({ search: 'e5bc9af6' });
    expect(nested.orWhere).toHaveBeenCalledWith(
      'LOWER(CAST(activity.requestId AS text)) LIKE :search', { search: '%e5bc9af6%' },
    );
  });
});
