import type { Court, TournamentDetail, TournamentScheduleSlot, TournamentZone, Venue } from '../types';

export function programMapFixture() {
  const venues = ['Ciudad de Buenos Aires', 'Gure Echea', 'GEBA'].map((name, index) => ({ id: index + 1, name, active: true } as Venue));
  const courts = venues.map((venue) => ({ id: venue.id, name: 'Cancha 1', venueId: venue.id, venue, active: true } as Court));
  const categories = ['Damas A', 'Damas B'].map((name, index) => ({ id: index + 1, categoryId: index + 1, zoneSize: 4, pointsPerSet: 25, setsToWin: 1, category: { id: index + 1, name, active: true } }));
  const zones: TournamentZone[] = [];
  const slots: TournamentScheduleSlot[] = [];
  for (const category of categories) {
    const categoryZones = ['A', 'B', 'C', 'D'].map((name, index) => ({ id: (category.id - 1) * 4 + index + 1, name, capacity: 4, tournamentCategoryId: category.id, tournamentCategory: category, venueId: index % 2 + 1, venue: venues[index % 2] } as TournamentZone));
    zones.push(...categoryZones);
    const add = (stage: TournamentScheduleSlot['stage'], order: number, zone?: TournamentZone, extra = {}) => {
      const id = slots.length + 1;
      const court = zone ? courts[zone.venueId - 1] : courts[2];
      const slot = { id, matchId: id + 100, tournamentId: 1, tournamentCategoryId: category.id, tournamentCategory: category, stage, zoneName: zone?.name ?? stage, matchOrder: order, sequence: id, courtId: court.id, court, scheduledAt: '2026-11-20T13:00:00Z', match: { id: id + 100, zoneId: zone?.id ?? null, matchOrder: order, status: 'PENDING', homeRegistration: null, awayRegistration: null, homeScore: null, awayScore: null, scheduledAt: '2026-11-20T13:00:00Z', ...extra } } as TournamentScheduleSlot;
      slots.push(slot); return slot;
    };
    for (const zone of categoryZones) for (let order = 1; order <= 4; order++) add('ZONE', order, zone);
    const quarters = categoryZones.map((zone, index) => add('QUARTERFINAL', index + 1, undefined, { homeQualifierZoneId: zone.id, homeQualifierRank: 1, awayQualifierZoneId: categoryZones[index ^ 1].id, awayQualifierRank: 2 }));
    const semis = [0, 1].map((index) => add('SEMIFINAL', index + 1, undefined, { homeSource: 'WINNER', awaySource: 'WINNER', homeSourceMatchId: quarters[index * 2].matchId, awaySourceMatchId: quarters[index * 2 + 1].matchId }));
    add('FINAL', 1, undefined, { homeSource: 'WINNER', awaySource: 'WINNER', homeSourceMatchId: semis[0].matchId, awaySourceMatchId: semis[1].matchId });
  }
  return { venues, courts, slots, tournament: { id: 1, name: 'Copa Leyendas Femme', categories, zones } as TournamentDetail };
}
