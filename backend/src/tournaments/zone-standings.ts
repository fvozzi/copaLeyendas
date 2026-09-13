import type { ZoneEntry } from './zone-entry.entity';
import type { TournamentMatch } from './tournament-match.entity';

export function standings(entries: ZoneEntry[], matches: TournamentMatch[]) {
  const rows = new Map(entries.map((entry) => [entry.registrationId, { registration: entry.registration, registrationId: entry.registrationId, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, tablePoints: 0 }]));
  for (const match of matches) {
    if (match.homeScore === null || match.awayScore === null || !match.homeRegistrationId || !match.awayRegistrationId) continue;
    const home = rows.get(match.homeRegistrationId); const away = rows.get(match.awayRegistrationId);
    if (!home || !away) continue;
    home.played += 1; away.played += 1; home.pointsFor += match.homeScore; home.pointsAgainst += match.awayScore; away.pointsFor += match.awayScore; away.pointsAgainst += match.homeScore;
    if (match.homeScore > match.awayScore) { home.wins += 1; home.tablePoints += 2; away.losses += 1; } else { away.wins += 1; away.tablePoints += 2; home.losses += 1; }
  }
  return [...rows.values()].sort((a, b) => b.tablePoints - a.tablePoints || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) || b.pointsFor - a.pointsFor);
}
