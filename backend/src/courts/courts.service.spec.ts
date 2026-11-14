import { describe, expect, it, vi } from 'vitest';
import { CourtsService } from './courts.service';
import type { Court } from './court.entity';
import type { Venue } from './venue.entity';
import type { VenueLeaderAssignment } from './venue-leader-assignment.entity';
import type { User } from '../auth/user.entity';

vi.mock('./court.entity', () => ({ Court: class Court {} }));
vi.mock('./venue.entity', () => ({ Venue: class Venue {} }));
vi.mock('./venue-leader-assignment.entity', () => ({ VenueLeaderAssignment: class VenueLeaderAssignment {} }));
vi.mock('../auth/user.entity', () => ({
  User: class User {},
  UserRole: { DIRECTOR: 'DIRECTOR', COURT_LEADER: 'COURT_LEADER', ASSISTANT: 'ASSISTANT' },
}));

describe('CourtsService', () => {
  it('resolves every serialized venue before returning the list', async () => {
    const venue = {
      id: 3,
      name: 'GEBA',
      startsAt: '10:00:00',
      matchDurationMinutes: 40,
      matchesPerDay: 16,
      active: true,
    } as Venue;
    const leader = { id: 8, name: 'Responsable', email: 'responsable@example.com' } as User;
    const assignment = { venueId: venue.id, userId: leader.id, user: leader } as VenueLeaderAssignment;
    const venues = { find: vi.fn().mockResolvedValue([venue]) };
    const assignments = { find: vi.fn().mockResolvedValue([assignment]) };
    const service = new CourtsService(
      {} as never as import('typeorm').Repository<Court>,
      venues as never,
      assignments as never,
      {} as never as import('typeorm').Repository<User>,
    );

    const result = await service.listVenues();

    expect(result).toEqual([{ ...venue, leaderIds: [leader.id], leaders: [{ id: leader.id, name: leader.name, email: leader.email }] }]);
    expect(result[0]).not.toBeInstanceOf(Promise);
  });
});
