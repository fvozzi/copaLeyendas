import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { In, Repository } from 'typeorm';
import { type AuthenticatedUser } from '../auth/current-user.decorator';
import { UserRole } from '../auth/user.entity';
import { VenueLeaderAssignment } from '../courts/venue-leader-assignment.entity';
import { Venue } from '../courts/venue.entity';
import { Player } from '../players/player.entity';
import { TournamentStatus } from './tournament.enums';
import { Tournament } from './tournament.entity';
import { ZoneEntry } from './zone-entry.entity';

export interface VenueRosterRow {
  id: number;
  venueId: number;
  venueName: string;
  playerId: number;
  fullName: string;
  dni: string;
  phone: string;
  category: string;
  team: string;
}

@Injectable()
export class TournamentVenueRosterService {
  constructor(
    @InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(VenueLeaderAssignment) private readonly assignments: Repository<VenueLeaderAssignment>,
    @InjectRepository(ZoneEntry) private readonly entries: Repository<ZoneEntry>,
    @InjectRepository(Player) private readonly players: Repository<Player>,
  ) {}

  async currentForUser(user: AuthenticatedUser) {
    const tournament = await this.tournaments.findOne({ where: { status: TournamentStatus.ACTIVE }, order: { startsAt: 'ASC', id: 'ASC' } });
    if (!tournament) return [];
    if (user.role === UserRole.DIRECTOR) return this.rows(tournament.id);
    if (user.role !== UserRole.COURT_LEADER && user.role !== UserRole.ASSISTANT) throw new ForbiddenException('Este perfil no puede consultar jugadoras de una sede.');
    const venueIds = (await this.assignments.find({ where: { userId: user.sub } })).map((assignment) => assignment.venueId);
    return venueIds.length ? this.rows(tournament.id, venueIds) : [];
  }

  async workbook(tournamentId: number, venueId: number, user: AuthenticatedUser) {
    const [tournament, venue] = await Promise.all([
      this.tournaments.findOneBy({ id: tournamentId }),
      this.venues.findOneBy({ id: venueId }),
    ]);
    if (!tournament) throw new NotFoundException('Torneo no encontrado');
    if (!venue) throw new NotFoundException('Sede no encontrada');
    await this.assertVenueAccess(user, venueId);
    const rows = await this.rows(tournamentId, [venueId]);
    return {
      buffer: await buildVenueRosterWorkbook(tournament.name, venue.name, rows),
      fileName: `jugadoras-${slug(tournament.name)}-${slug(venue.name)}.xlsx`,
    };
  }

  async rows(tournamentId: number, venueIds?: number[]) {
    if (venueIds && !venueIds.length) return [];
    const where = venueIds
      ? venueIds.map((venueId) => ({ zone: { venueId, tournamentCategory: { tournamentId } } }))
      : { zone: { tournamentCategory: { tournamentId } } };
    const entries = await this.entries.find({
      where: where as never,
      relations: { zone: { venue: true, tournamentCategory: { category: true } }, registration: { locality: true } },
      order: { zoneId: 'ASC', seed: 'ASC' },
    });
    const contexts = new Map<number, Array<{ venueId: number; venueName: string; category: string; team: string }>>();
    for (const entry of entries) {
      const localityId = entry.registration?.localityId;
      if (!localityId) continue;
      const context = {
        venueId: entry.zone.venueId,
        venueName: entry.zone.venue.name,
        category: entry.zone.tournamentCategory.category.name,
        team: entry.registration.locality.name,
      };
      const current = contexts.get(localityId) ?? [];
      if (!current.some((item) => item.venueId === context.venueId && item.category === context.category)) current.push(context);
      contexts.set(localityId, current);
    }
    const localityIds = [...contexts.keys()];
    if (!localityIds.length) return [];
    const players = await this.players.find({ where: { localityId: In(localityIds) }, order: { fullName: 'ASC', id: 'ASC' } });
    const rows = players.flatMap((player) => (contexts.get(player.localityId!) ?? []).map((context) => ({
      ...context,
      id: (context.venueId * 1_000_000) + player.id,
      playerId: player.id,
      fullName: player.fullName,
      dni: player.dni,
      phone: player.phone ?? '',
    })));
    return rows.sort((left, right) => left.venueName.localeCompare(right.venueName, 'es')
      || left.category.localeCompare(right.category, 'es')
      || left.fullName.localeCompare(right.fullName, 'es'));
  }

  private async assertVenueAccess(user: AuthenticatedUser, venueId: number) {
    if (user.role === UserRole.DIRECTOR) return;
    if ((user.role === UserRole.COURT_LEADER || user.role === UserRole.ASSISTANT)
      && await this.assignments.existsBy({ venueId, userId: user.sub })) return;
    throw new ForbiddenException('No estás asignado a esta sede.');
  }
}

export async function buildVenueRosterWorkbook(tournamentName: string, venueName: string, rows: VenueRosterRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Copa Leyendas';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = `Jugadoras de ${venueName}`;
  addGeneralSheet(workbook, tournamentName, venueName, rows);
  addGroupedSheet(workbook, tournamentName, venueName, rows);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function addGeneralSheet(workbook: ExcelJS.Workbook, tournamentName: string, venueName: string, rows: VenueRosterRow[]) {
  const sheet = workbook.addWorksheet('Listado general', { views: [{ state: 'frozen', ySplit: 4 }] });
  addSheetHeading(sheet, `Jugadoras de ${venueName}`, `${tournamentName} · ${rows.length} jugadoras`, 4);
  const header = sheet.addRow(['Jugadora', 'DNI', 'Teléfono', 'Categoría']);
  styleHeader(header);
  for (const item of [...rows].sort((left, right) => left.fullName.localeCompare(right.fullName, 'es'))) {
    styleDataRow(sheet.addRow([item.fullName, item.dni, item.phone, item.category]), 4);
  }
  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 22;
  sheet.getColumn(4).width = 24;
  sheet.getColumn(2).numFmt = '@';
  sheet.getColumn(3).numFmt = '@';
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, sheet.lastRow!.number), column: 4 } };
  finishSheet(sheet, 4);
}

function addGroupedSheet(workbook: ExcelJS.Workbook, tournamentName: string, venueName: string, rows: VenueRosterRow[]) {
  const sheet = workbook.addWorksheet('Por categoría', { views: [{ state: 'frozen', ySplit: 3 }] });
  addSheetHeading(sheet, `Jugadoras por categoría · ${venueName}`, tournamentName, 3);
  const categories = [...new Set(rows.map((row) => row.category))].sort((left, right) => left.localeCompare(right, 'es'));
  for (const category of categories) {
    const categoryRows = rows.filter((row) => row.category === category).sort((left, right) => left.fullName.localeCompare(right.fullName, 'es'));
    const categoryRow = sheet.addRow([`${category} · ${categoryRows.length} ${categoryRows.length === 1 ? 'jugadora' : 'jugadoras'}`]);
    sheet.mergeCells(categoryRow.number, 1, categoryRow.number, 3);
    categoryRow.font = { name: 'Aptos', bold: true, color: { argb: 'FF173F39' } };
    categoryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE1ECE5' } };
    categoryRow.height = 24;
    const header = sheet.addRow(['Jugadora', 'DNI', 'Teléfono']);
    styleHeader(header);
    for (const item of categoryRows) styleDataRow(sheet.addRow([item.fullName, item.dni, item.phone]), 3);
    sheet.addRow([]).height = 8;
  }
  if (!categories.length) {
    const empty = sheet.addRow(['No hay jugadoras asignadas a esta sede.']);
    sheet.mergeCells(empty.number, 1, empty.number, 3);
  }
  sheet.getColumn(1).width = 36;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 22;
  sheet.getColumn(2).numFmt = '@';
  sheet.getColumn(3).numFmt = '@';
  finishSheet(sheet, 3);
}

function addSheetHeading(sheet: ExcelJS.Worksheet, title: string, subtitle: string, columns: number) {
  sheet.mergeCells(1, 1, 1, columns);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173F39' } };
  sheet.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(2, 1, 2, columns);
  sheet.getCell(2, 1).value = subtitle;
  sheet.getCell(2, 1).font = { name: 'Aptos', size: 11, italic: true, color: { argb: 'FF4B5D61' } };
  sheet.getRow(2).height = 22;
  sheet.addRow([]);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { name: 'Aptos', bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCF6448' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 24;
}

function styleDataRow(row: ExcelJS.Row, columns: number) {
  row.height = 22;
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  for (let column = 1; column <= columns; column++) row.getCell(column).border = { bottom: { style: 'thin', color: { argb: 'FFD7DEDA' } } };
}

function finishSheet(sheet: ExcelJS.Worksheet, columns: number) {
  sheet.properties.defaultRowHeight = 20;
  sheet.pageSetup = {
    orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    paperSize: 9, printArea: `A1:${sheet.getColumn(columns).letter}${sheet.lastRow!.number}`,
  };
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'sede';
}
