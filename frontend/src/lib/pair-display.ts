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
