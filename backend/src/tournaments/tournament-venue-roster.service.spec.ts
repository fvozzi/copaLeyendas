import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../auth/user.entity';
import { buildVenueRosterWorkbook, TournamentVenueRosterService, type VenueRosterRow } from './tournament-venue-roster.service';

vi.mock('./tournament.entity', () => ({ Tournament: class Tournament {} }));
vi.mock('../courts/venue.entity', () => ({ Venue: class Venue {} }));
vi.mock('../courts/venue-leader-assignment.entity', () => ({ VenueLeaderAssignment: class VenueLeaderAssignment {} }));
vi.mock('./zone-entry.entity', () => ({ ZoneEntry: class ZoneEntry {} }));
vi.mock('../players/player.entity', () => ({ Player: class Player {} }));
vi.mock('../auth/user.entity', () => ({ UserRole: { DIRECTOR: 'DIRECTOR', COURT_LEADER: 'COURT_LEADER', ASSISTANT: 'ASSISTANT' } }));

const rows: VenueRosterRow[] = [
  { id: 1, venueId: 2, venueName: 'GEBA', playerId: 1, fullName: 'Zulema Pérez', dni: '30111222', phone: '5491111111111', category: 'Damas B', team: 'Corrientes' },
  { id: 2, venueId: 2, venueName: 'GEBA', playerId: 2, fullName: 'Ana Gómez', dni: '30222333', phone: '5491122222222', category: 'Damas A', team: 'Caseros' },
  { id: 3, venueId: 2, venueName: 'GEBA', playerId: 3, fullName: 'Beatriz López', dni: '30333444', phone: '', category: 'Damas A', team: 'Caseros' },
];

describe('venue player roster', () => {
  it('uses canonical players linked to teams assigned to zones at the venue', async () => {
    const entries = { find: vi.fn().mockResolvedValue([
      { zoneId: 10, seed: 1, zone: { venueId: 2, venue: { name: 'GEBA' }, tournamentCategory: { category: { name: 'Damas A' } } }, registration: { localityId: 7, locality: { name: 'Caseros' } } },
    ]) };
    const players = { find: vi.fn().mockResolvedValue([
      { id: 2, localityId: 7, fullName: 'Ana Gómez', dni: '30222333', phone: '5491122222222' },
      { id: 3, localityId: 7, fullName: 'Beatriz López', dni: '30333444', phone: null },
    ]) };
    const service = new TournamentVenueRosterService({} as never, {} as never, {} as never, entries as never, players as never);

    await expect(service.rows(1, [2])).resolves.toEqual([
      expect.objectContaining({ venueId: 2, fullName: 'Ana Gómez', category: 'Damas A', team: 'Caseros' }),
      expect.objectContaining({ venueId: 2, fullName: 'Beatriz López', phone: '', category: 'Damas A', team: 'Caseros' }),
    ]);
    expect(players.find).toHaveBeenCalledWith(expect.objectContaining({ order: { fullName: 'ASC', id: 'ASC' } }));
  });

  it('limits a court leader to assigned venues', async () => {
    const tournaments = { findOne: vi.fn().mockResolvedValue({ id: 1 }) };
    const assignments = { find: vi.fn().mockResolvedValue([{ venueId: 2 }]) };
    const service = new TournamentVenueRosterService(tournaments as never, {} as never, assignments as never, { find: vi.fn().mockResolvedValue([]) } as never, {} as never);

    await expect(service.currentForUser({ sub: 8, role: UserRole.COURT_LEADER } as never)).resolves.toEqual([]);
    expect(assignments.find).toHaveBeenCalledWith({ where: { userId: 8 } });
  });

  it('creates the two requested readable worksheets', async () => {
    const content = await buildVenueRosterWorkbook('Copa Leyendas Femme', 'GEBA', rows);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(content).buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Listado general', 'Por categoría']);
    const general = workbook.getWorksheet('Listado general')!;
    expect(general.getCell('A1').value).toBe('Jugadoras de GEBA');
    expect(general.getRow(4).values).toEqual([undefined, 'Jugadora', 'DNI', 'Teléfono', 'Categoría']);
    expect(general.getRow(5).values).toEqual([undefined, 'Ana Gómez', '30222333', '5491122222222', 'Damas A']);
    expect(general.getRow(7).values).toEqual([undefined, 'Zulema Pérez', '30111222', '5491111111111', 'Damas B']);
    expect(general.autoFilter).toBe('A4:D7');
    expect(general.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });

    const grouped = workbook.getWorksheet('Por categoría')!;
    expect(grouped.getCell('A4').value).toBe('Damas A · 2 jugadoras');
    expect(grouped.getRow(5).values).toEqual([undefined, 'Jugadora', 'DNI', 'Teléfono']);
    expect(grouped.getRow(6).values).toEqual([undefined, 'Ana Gómez', '30222333', '5491122222222']);
    expect(grouped.getCell('A9').value).toBe('Damas B · 1 jugadora');
  });
});
