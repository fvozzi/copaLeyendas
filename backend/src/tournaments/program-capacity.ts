import type { TournamentScheduleSlot } from './tournament-schedule-slot.entity';

// Recomputed from saved times too, so the warning remains visible after applying/reloading.
export function programCapacityWarnings(slots: TournamentScheduleSlot[]) {
  const counts = new Map<string, number>();
  const warnings: { sequence: number; message: string }[] = [];
  const scheduled = slots.filter((s) => s.scheduledAt && s.court?.venue).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime() || a.sequence - b.sequence);
  for (const slot of scheduled) {
    const venue = slot.court!.venue;
    if (!venue.matchesPerDay || !venue.matchDurationMinutes || !venue.startsAt) continue;
    const start = new Date(slot.scheduledAt!).getTime();
    const day = new Date(start - 3 * 3_600_000).toISOString().slice(0, 10);
    const key = `${slot.courtId}:${day}`;
    const count = (counts.get(key) ?? 0) + 1; counts.set(key, count);
    const opening = Date.parse(`${day}T${venue.startsAt.slice(0, 5)}:00-03:00`);
    const closing = opening + venue.matchesPerDay * venue.matchDurationMinutes * 60_000;
    if (count > venue.matchesPerDay || start < opening || start + venue.matchDurationMinutes * 60_000 > closing) warnings.push({ sequence: slot.sequence, message: `Fuera de los ${venue.matchesPerDay} turnos previstos por cancha en ${venue.name} el ${day}. Revisá la hora de cierre.` });
  }
  return warnings;
}
