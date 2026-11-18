export interface PairPlayerNames {
  playerOneName: string;
  playerTwoName: string;
  playerThreeName?: string | null;
}

export function pairPlayerNames(pair: PairPlayerNames) {
  return [pair.playerOneName, pair.playerTwoName, pair.playerThreeName]
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name))
    .join(' / ');
}

export function pairTeamName(pair: PairPlayerNames & { representingText?: string | null; locality?: { name?: string | null } }) {
  return pair.representingText?.trim() || pair.locality?.name?.trim() || pairPlayerNames(pair) || 'A definir';
}
