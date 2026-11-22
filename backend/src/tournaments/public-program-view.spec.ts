import { expect, it } from 'vitest';
import { publicProgramView } from './public-program-view';

it('publishes bracket references, names and scores without private registrations or staff data', () => {
  const category = { id: 2, categoryId: 3, category: { id: 3, name: 'Damas A' } };
  const venue = { id: 4, name: 'Ciudad' };
  const detail = { id: 1, name: 'Copa', driveFolderId: 'PRIVATE', categories: [category], zones: [{ id: 10, venueId: 4, venue, tournamentCategory: category, entries: [{ id: 30, seed: 1, registration: { id: 20, playerOneName: 'Ana', playerTwoName: 'Bea', playerThreeName: null, locality: { id: 3, name: 'Ciudad', provinceName: 'Buenos Aires' }, playerOneDni: 'PRIVATE' } }] }] };
  const slot = { id: 9, matchId: 8, stage: 'SEMIFINAL', sequence: 5, court: { id: 1, venue, assistants: [{ email: 'PRIVATE' }] }, tournamentCategory: category,
    scheduledAt: new Date('2026-11-21T15:00:00Z'), match: { id: 8, homeSourceMatchId: 6, awaySourceMatchId: 7, homeSource: 'WINNER', awaySource: 'WINNER', status: 'PLAYED', homeScore: 21, awayScore: 18, resultPhotoStoredName: 'result-secret.jpg', resultSourcePhotoStoredName: 'source-secret.jpg',
      homeRegistration: { id: 20, playerOneName: 'Ana', playerTwoName: 'Bea', playerThreeName: 'Ceci', locality: { id: 3, name: 'Ciudad', provinceName: 'Buenos Aires' }, playerOneDni: 'PRIVATE', contactEmail: 'PRIVATE', adminNotes: 'PRIVATE', paymentProofStoredName: 'PRIVATE', accessGrant: { token: 'PRIVATE' } }, awayRegistration: null } };
  const result = publicProgramView(detail as never, [slot as never, { ...slot, stage: 'ZONE', matchId: null } as never]);
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
  expect(result.slots).toHaveLength(1);
  expect(result.slots[0].match).toMatchObject({ homeSourceMatchId: 6, awaySourceMatchId: 7, homeScore: 21, awayScore: 18, homeRegistration: { playerOneName: 'Ana', playerTwoName: 'Bea', playerThreeName: 'Ceci' } });
  expect(result.slots[0].match?.photoUrl).toContain('/api/public/tournaments/matches/8/photo?v=');
  expect(result.slots[0].match?.cleanPhotoUrl).toContain('/api/public/tournaments/matches/8/clean-photo?v=');
  expect(JSON.stringify(result)).not.toContain('source-secret.jpg');
  expect(result.slots[0].scheduledAt).toEqual(slot.scheduledAt);
  expect(result.detail.zones[0].venue.name).toBe('Ciudad');
  expect(result.detail.zones[0].entries[0]).toMatchObject({ seed: 1, registration: { id: 20, playerOneName: 'Ana', playerTwoName: 'Bea' } });
});

it('publishes the initial photo and start time while a match is in progress', () => {
  const category = { id: 2, categoryId: 3, category: { id: 3, name: 'Damas B' } };
  const venue = { id: 4, name: 'Gure Echea' };
  const startedAt = new Date('2026-11-21T15:03:00Z');
  const detail = { id: 1, name: 'Copa', categories: [category], zones: [{ id: 10, venueId: 4, venue, tournamentCategory: category, entries: [] }] };
  const slot = { id: 9, matchId: 8, stage: 'ZONE', sequence: 5, court: { id: 1, venue }, tournamentCategory: category, scheduledAt: new Date('2026-11-21T15:00:00Z'),
    match: { id: 8, zoneId: 10, zone: { id: 10, name: 'Zona A', capacity: 3 }, status: 'IN_PROGRESS', startedAt, resultSubmittedAt: null, resultPhotoStoredName: 'private-name.jpg', homeRegistration: null, awayRegistration: null } };
  const result = publicProgramView(detail as never, [slot as never]);
  expect(result.slots[0].zoneCapacity).toBe(3);
  expect(result.slots[0].match).toMatchObject({ status: 'IN_PROGRESS', startedAt, resultPhotoAvailable: true });
  expect(result.slots[0].match?.photoUrl).toContain('/api/public/tournaments/matches/8/photo?v=');
  expect(JSON.stringify(result)).not.toContain('private-name.jpg');
});
