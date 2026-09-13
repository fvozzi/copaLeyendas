import type { TournamentMatch } from './tournament-match.entity';
import type { TournamentScheduleSlot } from './tournament-schedule-slot.entity';

export const programRelations = { court: { venue: true }, tournamentCategory: { category: true }, match: { zone: true, homeRegistration: true, awayRegistration: true } } as const;

export function matchView(match: TournamentMatch, slot = match.scheduleSlot) {
  const { scheduleSlot: _scheduleSlot, ...data } = match;
  return { ...data, scheduledAt: slot ? slot.scheduledAt : match.scheduledAt, court: slot?.court ?? null, scheduleSlotId: slot?.id ?? null, sequence: slot?.sequence ?? null };
}

export function programView(slots: TournamentScheduleSlot[]) {
  // A legacy fourth planning row for a three-pair zone is not a real game.
  return slots.filter((slot) => slot.stage !== 'ZONE' || slot.matchId).map((slot) => ({
    ...slot, zoneName: slot.match?.zone?.name ?? slot.zoneName,
    match: slot.match ? matchView(slot.match, slot) : null,
  }));
}
