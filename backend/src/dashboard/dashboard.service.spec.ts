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

describe('category capacity summary', () => {
  it('counts all generated grants separately from director-confirmed registrations and includes empty categories', async () => {
    const a = { id: 1, name: 'Damas A' };
    const b = { id: 2, name: 'Damas B' };
    const registrations = ['RECEIVED', 'UNDER_REVIEW', 'CONFIRMED', 'WAITLIST', 'REJECTED'].map((status) => ({ categoryId: 1, category: a, status }));
    const grants = ['ACTIVE', 'USED', 'REVOKED'].map((status) => ({ categoryId: 1, category: a, status }));
    const empty = { find: vi.fn(async () => []) };
    const service = new DashboardService(empty as never, { find: vi.fn(async () => registrations) } as never,
      { find: vi.fn(async () => grants) } as never, { findOne: vi.fn(async () => null) } as never,
      empty as never, { find: vi.fn(async () => [a, b]) } as never);
    const summary = await service.getSummary();
    expect(summary.accessGrants.byCategory).toEqual({ 'Damas A': 3, 'Damas B': 0 });
    expect(summary.registrations.byCategory).toEqual({ 'Damas A': 5, 'Damas B': 0 });
    expect(summary.registrations.confirmedByCategory).toEqual({ 'Damas A': 1, 'Damas B': 0 });
  });
});
