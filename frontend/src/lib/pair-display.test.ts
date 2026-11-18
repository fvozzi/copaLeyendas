import { expect, it } from 'vitest';
import { pairPlayerNames, pairTeamName } from './pair-display';

it('shows the complete current roster and ignores an empty third position', () => {
  expect(pairPlayerNames({ playerOneName: 'Ana', playerTwoName: 'Bea', playerThreeName: 'Ceci' })).toBe('Ana / Bea / Ceci');
  expect(pairPlayerNames({ playerOneName: 'Ana', playerTwoName: 'Bea', playerThreeName: '  ' })).toBe('Ana / Bea');
});

it('uses the team identity without repeating the player roster', () => {
  const pair = { playerOneName: 'Ana', playerTwoName: 'Bea', locality: { name: 'Gualeguaychú II' } };
  expect(pairTeamName(pair)).toBe('Gualeguaychú II');
  expect(pairPlayerNames(pair)).toBe('Ana / Bea');
});
