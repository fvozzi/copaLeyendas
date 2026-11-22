import { expect, it } from 'vitest';
import type { PublicCurrentTournament } from '../types';
import { tournamentMatchPhotos } from './TournamentEditionPage';

it('includes played zone, quarterfinal, semifinal and final photos in the public gallery', () => {
  const registration = (id: number, name: string) => ({ id, playerOneName: `${name} 1`, playerTwoName: `${name} 2`, locality: { id, name, provinceName: 'Buenos Aires' } });
  const match = (id: number) => ({
    id, status: 'PLAYED', homeScore: 25, awayScore: 18, scheduledAt: `2026-11-22T${String(id).padStart(2, '0')}:00:00Z`,
    homeRegistration: registration(id, `Local ${id}`), awayRegistration: registration(id + 10, `Visitante ${id}`),
    photoUrl: `/api/public/tournaments/matches/${id}/photo`, cleanPhotoUrl: `/api/public/tournaments/matches/${id}/clean-photo`,
  });
  const category = { category: { name: 'Damas A' } };
  const current = {
    courts: [],
    tournament: {
      zones: [{ id: 1, category: 'Damas A', name: 'Zona A', venue: { name: 'Sede' }, matches: [{ ...match(1), sequence: 1 }], standings: [] }],
      knockout: [
        { id: 2, stage: 'QUARTERFINAL', sequence: 2, matchOrder: 1, tournamentCategory: category, court: { venue: { name: 'Sede' } }, match: match(2) },
        { id: 3, stage: 'SEMIFINAL', sequence: 3, matchOrder: 1, tournamentCategory: category, court: { venue: { name: 'Sede' } }, match: match(3) },
        { id: 4, stage: 'FINAL', sequence: 4, matchOrder: 1, tournamentCategory: category, court: { venue: { name: 'Sede' } }, match: match(4) },
      ],
    },
  } as unknown as PublicCurrentTournament;

  expect(tournamentMatchPhotos(current).map((photo) => [photo.id, photo.stage])).toEqual([
    [1, 'Zona A'],
    [2, 'Cuartos de final'],
    [3, 'Semifinal'],
    [4, 'Final'],
  ]);
});
