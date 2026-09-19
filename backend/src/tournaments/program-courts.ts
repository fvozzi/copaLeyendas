import type { Court } from '../courts/court.entity';
import type { Venue } from '../courts/venue.entity';
import type { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import type { Zone } from './zone.entity';
import { BadRequestException } from '@nestjs/common';

// Zone games follow their configured venue. Knockouts retain their chosen venue.
// Fixed games reserve their courts and times when moving only part of a program.
export function redistributeExistingCourts(slots: TournamentScheduleSlot[], zones: Zone[], courts: Court[], fixedSlots: TournamentScheduleSlot[] = [], moveConflicts = false) {
  const counts = new Map<number, number>();
  const occupied = new Map<number, { start: number; end: number }[]>();
  const zoneEnds = new Map<number, Map<number, number>>();
  for (const slot of fixedSlots) {
    const court = courts.find((item) => item.id === slot.courtId);
    if (!court) continue;
    counts.set(court.id, (counts.get(court.id) ?? 0) + 1);
    if (slot.scheduledAt && court.venue) {
      const start = slot.scheduledAt.getTime();
      occupied.set(court.id, [...(occupied.get(court.id) ?? []), { start, end: start + court.venue.matchDurationMinutes * 60_000 }]);
      const zone = zones.find((item) => item.id === slot.match?.zoneId);
      if (moveConflicts && zone) {
        const ends = zoneEnds.get(zone.id) ?? new Map<number, number>();
        ends.set(slot.matchOrder, start + court.venue.matchDurationMinutes * 60_000);
        zoneEnds.set(zone.id, ends);
      }
    }
  }
  for (const slot of [...slots].sort((a, b) => moveConflicts
    ? a.matchOrder - b.matchOrder || a.sequence - b.sequence
    : (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity) || a.sequence - b.sequence)) {
    const originalCourt = courts.find((court) => court.id === slot.courtId);
    const zone = slot.stage === 'ZONE' && slot.match?.zoneId
      ? zones.find((item) => item.id === slot.match!.zoneId)
      : zones.find((item) => item.tournamentCategoryId === slot.tournamentCategoryId && (slot.stage !== 'ZONE' || item.name === slot.zoneName));
    const venue = slot.stage === 'ZONE' ? zone?.venue : originalCourt?.venue ?? zone?.venue;
    if (!venue?.active) throw new BadRequestException(`El partido ${slot.sequence} no tiene una sede activa.`);
    const priorOrders = zone?.capacity === 3
      ? Array.from({ length: Math.max(0, slot.matchOrder - 1) }, (_, index) => index + 1)
      : slot.matchOrder > 2 ? [1, 2] : [];
    const priorEnds = moveConflicts && zone ? priorOrders.map(order => zoneEnds.get(zone.id)?.get(order) ?? 0) : [];
    const start = slot.scheduledAt ? Math.max(slot.scheduledAt.getTime(), ...priorEnds) : undefined;
    const duration = venue.matchDurationMinutes * 60_000;
    const available = courts.filter((court) => court.active && court.venueId === venue.id);
    const options = available.flatMap((court) => {
      if (start === undefined) return [{ court, start: undefined as number | undefined }];
      let candidate = start;
      // Daily turn counts only produce warnings; search past them when moving a zone.
      for (const range of [...(occupied.get(court.id) ?? [])].sort((a, b) => a.start - b.start)) {
        if (candidate + duration <= range.start) break;
        if (candidate < range.end && candidate + duration > range.start) candidate = range.end;
      }
      return moveConflicts || candidate === start ? [{ court, start: candidate }] : [];
    }).sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || (counts.get(a.court.id) ?? 0) - (counts.get(b.court.id) ?? 0) || a.court.id - b.court.id);
    const chosen = options[0];
    if (!chosen) throw new BadRequestException(moveConflicts
      ? `No hay canchas activas en ${venue.name} para asignar los partidos de la zona.`
      : `No hay una cancha activa disponible para el partido ${slot.sequence} en ${venue.name}. Revisá las canchas y los horarios.`);
    slot.courtId = chosen.court.id;
    if (moveConflicts && chosen.start !== undefined && chosen.start !== slot.scheduledAt?.getTime()) slot.scheduledAt = new Date(chosen.start);
    counts.set(chosen.court.id, (counts.get(chosen.court.id) ?? 0) + 1);
    if (chosen.start !== undefined) occupied.set(chosen.court.id, [...(occupied.get(chosen.court.id) ?? []), { start: chosen.start, end: chosen.start + duration }]);
    if (moveConflicts && zone && chosen.start !== undefined) {
      const ends = zoneEnds.get(zone.id) ?? new Map<number, number>();
      ends.set(slot.matchOrder, chosen.start + duration);
      zoneEnds.set(zone.id, ends);
    }
  }
}

// Allocate each court independently, waiting for the games that feed the next round.
export function distributeProgramCourts(
  slots: TournamentScheduleSlot[], zones: Zone[], courts: Court[],
  dateAt: (venue: Venue, index: number) => Date | null,
  fixedSlots: TournamentScheduleSlot[] = [],
) {
  const nextIndex = new Map<number, number>();
  const ends = new Map<TournamentScheduleSlot, number | null>();
  const previous: TournamentScheduleSlot[] = [...fixedSlots];
  const occupied = new Map<number, { start: number; end: number }[]>();
  for (const slot of fixedSlots) {
    const court = courts.find((item) => item.id === slot.courtId);
    const end = slot.scheduledAt && court?.venue ? slot.scheduledAt.getTime() + court.venue.matchDurationMinutes * 60_000 : null;
    ends.set(slot, end);
    if (court && end !== null) occupied.set(court.id, [...(occupied.get(court.id) ?? []), { start: slot.scheduledAt!.getTime(), end }]);
  }
  for (const slot of slots) {
    const zone = slot.stage === 'ZONE' && slot.match?.zoneId
      ? zones.find((item) => item.id === slot.match!.zoneId)
      : zones.find((item) => item.tournamentCategoryId === slot.tournamentCategoryId && (slot.stage !== 'ZONE' || item.name === slot.zoneName));
    const venue = (slot.stage !== 'ZONE' ? courts.find((court) => court.id === slot.courtId)?.venue : null) ?? zone?.venue;
    const available = courts.filter((court) => court.active && court.venueId === venue?.id && venue?.active);
    const categoryGames = previous.filter((item) => item.tournamentCategoryId === slot.tournamentCategoryId);
    const priorStage = slot.stage === 'QUARTERFINAL' || (slot.stage === 'SEMIFINAL' && !categoryGames.some((item) => item.stage === 'QUARTERFINAL')) ? 'ZONE' : slot.stage === 'SEMIFINAL' ? 'QUARTERFINAL' : 'SEMIFINAL';
    const dependencies = slot.stage === 'ZONE'
      ? categoryGames.filter((item) => item.stage === 'ZONE' && item.zoneName === slot.zoneName && item.matchOrder < slot.matchOrder && (zone?.capacity === 3 || (slot.matchOrder > 2 && item.matchOrder <= 2)))
      : categoryGames.filter((item) => item.stage === priorStage);
    const blocked = dependencies.some((item) => ends.get(item) == null);
    const earliest = Math.max(0, ...dependencies.map((item) => ends.get(item) ?? 0));
    const candidates = available.map((court) => {
      let index = nextIndex.get(court.id) ?? 0;
      let date = blocked ? null : dateAt(venue!, index);
      while (date && (date.getTime() < earliest || (occupied.get(court.id) ?? []).some((range) => date!.getTime() < range.end && date!.getTime() + venue!.matchDurationMinutes * 60_000 > range.start))) date = dateAt(venue!, ++index);
      return { court, index, date };
    }).sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity) || a.index - b.index || a.court.id - b.court.id);
    const chosen = candidates[0];
    slot.courtId = chosen?.court.id ?? null;
    slot.scheduledAt = chosen?.date ?? null;
    if (chosen) nextIndex.set(chosen.court.id, chosen.index + 1);
    ends.set(slot, slot.scheduledAt && venue ? slot.scheduledAt.getTime() + venue.matchDurationMinutes * 60_000 : null);
    if (slot.courtId && slot.scheduledAt && venue) occupied.set(slot.courtId, [...(occupied.get(slot.courtId) ?? []), { start: slot.scheduledAt.getTime(), end: ends.get(slot)! }]);
    previous.push(slot);
  }
}
