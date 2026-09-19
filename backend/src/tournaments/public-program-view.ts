import type { TournamentQueryService } from './tournament-query.service';
import type { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import type { Venue } from '../courts/venue.entity';
import type { Court } from '../courts/court.entity';
import type { PairRegistration } from '../registrations/pair-registration.entity';
import type { TournamentCategory } from './tournament-category.entity';

const publicPair = (pair: PairRegistration | null) => pair ? ({
  id: pair.id, playerOneName: pair.playerOneName, playerTwoName: pair.playerTwoName, localityName: pair.localityName,
}) : null;
const publicVenue = (venue: Venue) => ({
  id: venue.id, name: venue.name, address: venue.address, city: venue.city, provinceName: venue.provinceName,
  startsAt: venue.startsAt, matchDurationMinutes: venue.matchDurationMinutes, matchesPerDay: venue.matchesPerDay, active: venue.active,
});
const publicCourt = (court: Court | null) => court ? ({
  id: court.id, name: court.name, venueId: court.venueId, venue: court.venue ? publicVenue(court.venue) : undefined,
  active: court.active,
}) : null;
const publicCategory = (category: TournamentCategory) => ({
  id: category.id, categoryId: category.categoryId, pointsPerSet: category.pointsPerSet, setsToWin: category.setsToWin,
  zoneSize: category.zoneSize, zoneCount: category.zoneCount, category: { id: category.category.id, name: category.category.name, active: category.category.active, sortOrder: category.category.sortOrder },
});

// Explicit public projection: never serialize registration entities or staff assignments.
export function publicProgramView(detail: Awaited<ReturnType<TournamentQueryService['detail']>>, slots: TournamentScheduleSlot[]) {
  return {
    detail: {
      id: detail.id, name: detail.name, startsAt: detail.startsAt, endsAt: detail.endsAt, city: detail.city,
      status: detail.status, playingDays: detail.playingDays,
      categories: detail.categories.map(publicCategory),
      zones: detail.zones.map(zone => ({
        id: zone.id, name: zone.name, capacity: zone.capacity, tournamentCategoryId: zone.tournamentCategoryId,
        venueId: zone.venueId, venue: publicVenue(zone.venue), tournamentCategory: publicCategory(zone.tournamentCategory),
      })),
    },
    slots: slots.filter(slot => slot.stage !== 'ZONE' || slot.matchId).map(slot => ({
      id: slot.id, matchId: slot.matchId, tournamentId: slot.tournamentId, tournamentCategoryId: slot.tournamentCategoryId,
      zoneName: slot.match?.zone?.name ?? slot.zoneName, matchOrder: slot.matchOrder, stage: slot.stage, sequence: slot.sequence,
      courtId: slot.courtId, court: publicCourt(slot.court), scheduledAt: slot.scheduledAt,
      tournamentCategory: publicCategory(slot.tournamentCategory),
      match: slot.match ? {
        id: slot.match.id, zoneId: slot.match.zoneId, matchOrder: slot.match.matchOrder, status: slot.match.status,
        homeQualifierZoneId: slot.match.homeQualifierZoneId, awayQualifierZoneId: slot.match.awayQualifierZoneId,
        homeQualifierRank: slot.match.homeQualifierRank, awayQualifierRank: slot.match.awayQualifierRank,
        homeSource: slot.match.homeSource, awaySource: slot.match.awaySource,
        homeSourceMatchId: slot.match.homeSourceMatchId, awaySourceMatchId: slot.match.awaySourceMatchId,
        homeRegistration: publicPair(slot.match.homeRegistration), awayRegistration: publicPair(slot.match.awayRegistration),
        homeScore: slot.match.homeScore, awayScore: slot.match.awayScore, scheduledAt: slot.scheduledAt,
      } : null,
    })),
  };
}
