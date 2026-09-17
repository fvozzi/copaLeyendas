import { expect, it } from 'vitest';
import { publicProgramView } from './public-program-view';

it('publishes bracket references, names and scores without private registrations or staff data', () => {
  const category = { id: 2, categoryId: 3, category: { id: 3, name: 'Damas A' } };
  const venue = { id: 4, name: 'Ciudad' };
  const detail = { id: 1, name: 'Copa', driveFolderId: 'PRIVATE', categories: [category], zones: [{ id: 10, venueId: 4, venue, tournamentCategory: category }] };
  const slot = { id: 9, matchId: 8, stage: 'SEMIFINAL', sequence: 5, court: { id: 1, venue, assistants: [{ email: 'PRIVATE' }] }, tournamentCategory: category,
    scheduledAt: new Date('2026-11-21T15:00:00Z'), match: { id: 8, homeSourceMatchId: 6, awaySourceMatchId: 7, homeSource: 'WINNER', awaySource: 'WINNER', status: 'PLAYED', homeScore: 21, awayScore: 18,
      homeRegistration: { id: 20, playerOneName: 'Ana', playerTwoName: 'Bea', localityName: 'Ciudad', playerOneDni: 'PRIVATE', contactEmail: 'PRIVATE', adminNotes: 'PRIVATE', paymentProofStoredName: 'PRIVATE', accessGrant: { token: 'PRIVATE' } }, awayRegistration: null } };
  const result = publicProgramView(detail as never, [slot as never, { ...slot, stage: 'ZONE', matchId: null } as never]);
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
  expect(result.slots).toHaveLength(1);
  expect(result.slots[0].match).toMatchObject({ homeSourceMatchId: 6, awaySourceMatchId: 7, homeScore: 21, awayScore: 18, homeRegistration: { playerOneName: 'Ana', playerTwoName: 'Bea' } });
  expect(result.slots[0].scheduledAt).toEqual(slot.scheduledAt);
  expect(result.detail.zones[0].venue.name).toBe('Ciudad');
});
