import { describe, expect, it } from 'vitest';
import { renderVenueWorksheetPdf, type VenueWorksheetData, type VenueWorksheetMatch } from './venue-worksheet-pdf';

const match = (sequence: number, matchOrder: number, overrides: Partial<VenueWorksheetMatch> = {}): VenueWorksheetMatch => ({
  sequence, matchOrder, home: 'Equipo local', away: 'Equipo visitante', homeSource: '1.ª de Zona A', awaySource: '2.ª de Zona B',
  homeScore: null, awayScore: null, court: 'Cancha 1', venue: 'Ciudad de Buenos Aires', scheduledAt: new Date('2026-11-22T13:00:00Z'), atWorksheetVenue: true, ...overrides,
});

describe('venue worksheet PDF', () => {
  it('renders an A3 landscape document with zone tables and the complete knockout bracket', async () => {
    const data: VenueWorksheetData = {
      tournamentName: 'Copa Leyendas Femme', venueName: 'Ciudad de Buenos Aires', venueAddress: 'Av. del Torneo 123', generatedAt: new Date('2026-11-12T12:00:00Z'),
      categories: [{
        name: 'Silvina Cimadamore',
        zones: [{
          name: 'Zona A',
          teams: Array.from({ length: 4 }, (_, index) => ({ seed: index + 1, name: `Equipo ${index + 1} · Jugadora A / Jugadora B`, players: 'Jugadora A / Jugadora B', played: index, wins: Math.max(0, index - 1), pointsFor: index * 25, pointsAgainst: index * 12 })),
          matches: Array.from({ length: 4 }, (_, index) => match(index + 1, index + 1, { home: `Equipo ${index + 1}`, away: `Equipo ${index + 2}` })),
        }],
        knockout: {
          QUARTERFINAL: Array.from({ length: 4 }, (_, index) => match(20 + index, index + 1)),
          SEMIFINAL: Array.from({ length: 2 }, (_, index) => match(30 + index, index + 1, { homeSource: `Ganadora P${20 + index * 2}`, awaySource: `Ganadora P${21 + index * 2}` })),
          FINAL: [match(40, 1, { homeSource: 'Ganadora P30', awaySource: 'Ganadora P31' })],
        },
      }],
    };

    const pdf = await renderVenueWorksheetPdf(data);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(pdf.toString('latin1')).toContain('/MediaBox [0 0 1190.55 841.89]');
  });
});
