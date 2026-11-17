import type { Court, Venue } from '../types';

export function venuesWithEnabledCourts(courts: Court[]): Venue[] {
  const venues = new Map<number, Venue>();
  for (const court of courts) {
    if (!court.active || !court.venue?.active) continue;
    venues.set(court.venue.id, court.venue);
  }
  return [...venues.values()].sort((left, right) => left.name.localeCompare(right.name, 'es'));
}
