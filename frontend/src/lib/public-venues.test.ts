import { expect, it } from 'vitest';
import type { Court, Venue } from '../types';
import { venuesWithEnabledCourts } from './public-venues';

const venue = (id: number, name: string, active = true) => ({ id, name, active }) as Venue;
const court = (id: number, name: string, assignedVenue: Venue | undefined, active = true) => ({
  id,
  name,
  venueId: assignedVenue?.id ?? 0,
  venue: assignedVenue,
  active,
  address: null,
  city: null,
  provinceName: null,
}) as Court;

it('shows each active venue once when it has at least one enabled court', () => {
  const geba = venue(2, 'GEBA');
  const ciudad = venue(1, 'Ciudad de Buenos Aires');
  const inactiveVenue = venue(3, 'Sede inactiva', false);

  expect(venuesWithEnabledCourts([
    court(1, 'Cancha 1', geba),
    court(2, 'Cancha 2', geba),
    court(3, 'Cancha 1', ciudad),
    court(4, 'Cancha cerrada', venue(4, 'Sin canchas habilitadas'), false),
    court(5, 'Cancha activa en sede inactiva', inactiveVenue),
  ]).map((item) => item.name)).toEqual(['Ciudad de Buenos Aires', 'GEBA']);
});
