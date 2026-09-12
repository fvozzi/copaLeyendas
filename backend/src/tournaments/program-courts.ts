import type { Court } from '../courts/court.entity';
import type { Venue } from '../courts/venue.entity';
import type { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import type { Zone } from './zone.entity';

// Allocate each court independently, waiting for the games that feed the next round.
export function distributeProgramCourts(
  slots: TournamentScheduleSlot[], zones: Zone[], courts: Court[],
  dateAt: (venue: Venue, index: number) => Date | null,
) {
  const nextIndex = new Map<number, number>();
  const ends = new Map<TournamentScheduleSlot, number | null>();
  const previous: TournamentScheduleSlot[] = [];
  for (const slot of slots) {
    const zone = zones.find((item) => item.tournamentCategoryId === slot.tournamentCategoryId && (slot.stage !== 'ZONE' || item.name === slot.zoneName));
    const venue = zone?.venue;
    const available = courts.filter((court) => court.active && court.venueId === venue?.id && venue?.active);
    const categoryGames = previous.filter((item) => item.tournamentCategoryId === slot.tournamentCategoryId);
    const priorStage = slot.stage === 'QUARTERFINAL' ? 'ZONE' : slot.stage === 'SEMIFINAL' ? 'QUARTERFINAL' : 'SEMIFINAL';
    const dependencies = slot.stage === 'ZONE'
      ? categoryGames.filter((item) => item.stage === 'ZONE' && item.zoneName === slot.zoneName && (zone?.capacity === 3 || (slot.matchOrder > 2 && item.matchOrder <= 2)))
      : categoryGames.filter((item) => item.stage === priorStage);
    const blocked = dependencies.some((item) => ends.get(item) == null);
    const earliest = Math.max(0, ...dependencies.map((item) => ends.get(item) ?? 0));
    const candidates = available.map((court) => {
      let index = nextIndex.get(court.id) ?? 0;
      let date = blocked ? null : dateAt(venue!, index);
      while (date && date.getTime() < earliest) date = dateAt(venue!, ++index);
      return { court, index, date };
    }).sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity) || a.index - b.index || a.court.id - b.court.id);
    const chosen = candidates[0];
    slot.courtId = chosen?.court.id ?? null;
    slot.scheduledAt = chosen?.date ?? null;
    if (chosen) nextIndex.set(chosen.court.id, chosen.index + 1);
    ends.set(slot, slot.scheduledAt && venue ? slot.scheduledAt.getTime() + venue.matchDurationMinutes * 60_000 : null);
    previous.push(slot);
  }
}
