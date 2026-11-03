import { expect, it } from 'vitest';
import { standings } from './zone-standings';

it('orders standings by wins, point difference and points for', () => {
  const entries = [1, 2, 3, 4].map((registrationId) => ({ registrationId, registration: { id: registrationId } }));
  const matches = [
    { homeRegistrationId: 1, awayRegistrationId: 2, homeScore: 25, awayScore: 20 },
    { homeRegistrationId: 3, awayRegistrationId: 4, homeScore: 25, awayScore: 15 },
    { homeRegistrationId: 1, awayRegistrationId: 3, homeScore: 22, awayScore: 25 },
    { homeRegistrationId: 2, awayRegistrationId: 4, homeScore: 25, awayScore: 10 },
  ];
  const rows = standings(entries as never, matches as never);
  expect(rows.map((row) => row.registrationId)).toEqual([3, 2, 1, 4]);
  expect(rows[0]).toMatchObject({ wins: 2, pointsFor: 50, pointsAgainst: 37 });
  expect(rows[1]).toMatchObject({ wins: 1, pointsFor: 45, pointsAgainst: 35 });
});
