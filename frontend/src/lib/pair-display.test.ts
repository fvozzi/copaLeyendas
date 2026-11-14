import { expect, it } from 'vitest';
import { pairPlayerNames } from './pair-display';

it('shows the complete current roster and ignores an empty third position', () => {
  expect(pairPlayerNames({ playerOneName: 'Ana', playerTwoName: 'Bea', playerThreeName: 'Ceci' })).toBe('Ana / Bea / Ceci');
  expect(pairPlayerNames({ playerOneName: 'Ana', playerTwoName: 'Bea', playerThreeName: '  ' })).toBe('Ana / Bea');
});
