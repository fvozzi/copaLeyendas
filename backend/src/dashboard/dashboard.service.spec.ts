import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service';
vi.mock('../posts/content-post.entity', () => ({ ContentPost: class ContentPost {} }));
vi.mock('../registrations/pair-registration.entity', () => ({ PairRegistration: class PairRegistration {} }));
vi.mock('../registrations/registration-access-grant.entity', () => ({ RegistrationAccessGrant: class RegistrationAccessGrant {} }));
vi.mock('../tournaments/tournament.entity', () => ({ Tournament: class Tournament {} }));
vi.mock('../tournaments/zone.entity', () => ({ Zone: class Zone {} }));
vi.mock('../categories/category.entity', () => ({ Category: class Category {} }));

describe('shirt summary', () => {
  it('ignores a saved default size when the third player is absent, but counts actual third players', async () => {
    const registration = { playerOneName: 'One', playerTwoName: 'Two', playerThreeName: ' ', playerOneShirtSize: 'M', playerTwoShirtSize: 'M', playerThreeShirtSize: 'M' };
    const empty = { find: vi.fn(async () => []) };
    const service = new DashboardService(empty as never, { find: vi.fn(async () => [registration]) } as never, empty as never, { findOne: vi.fn(async () => null) } as never, empty as never, empty as never);
    expect((await service.getSummary()).registrations.shirtSizes).toEqual({ M: 2 });
    registration.playerThreeName = 'Three';
    expect((await service.getSummary()).registrations.shirtSizes).toEqual({ M: 3 });
  });
});
