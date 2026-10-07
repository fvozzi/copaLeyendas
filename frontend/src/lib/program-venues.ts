import type { TournamentScheduleSlot, TournamentZone } from '../types';

export function feederVenueId(slot: TournamentScheduleSlot, slots: TournamentScheduleSlot[], zones: TournamentZone[], path = new Set<number>()): number | undefined {
  if (path.has(slot.id)) return undefined;
  const categoryZones = zones
    .filter((zone) => zone.tournamentCategoryId === slot.tournamentCategoryId)
    .sort((left, right) => left.name.localeCompare(right.name, 'es', { numeric: true }));
  if (slot.stage === 'ZONE') return categoryZones.find((zone) => zone.id === slot.match?.zoneId)?.venueId
    ?? categoryZones.find((zone) => zone.name === slot.zoneName)?.venueId;

  const qualifierZoneId = slot.match?.homeQualifierZoneId ?? slot.match?.awayQualifierZoneId;
  if (qualifierZoneId) return categoryZones.find((zone) => zone.id === qualifierZoneId)?.venueId;

  if (slot.stage === 'SEMIFINAL') {
    const sourceMatchId = slot.match?.homeSourceMatchId ?? slot.match?.awaySourceMatchId;
    const source = sourceMatchId ? slots.find((candidate) => candidate.matchId === sourceMatchId) : undefined;
    if (source) return feederVenueId(source, slots, zones, new Set(path).add(slot.id));
  }

  const index = slot.stage === 'SEMIFINAL' && categoryZones.length >= 4
    ? (slot.matchOrder - 1) * 2
    : slot.matchOrder - 1;
  return (categoryZones[index] ?? categoryZones[0])?.venueId;
}
