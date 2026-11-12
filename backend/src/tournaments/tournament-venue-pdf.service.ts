import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { In, Repository } from 'typeorm';
import { Venue } from '../courts/venue.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { Tournament } from './tournament.entity';
import { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import { Zone } from './zone.entity';
import { ZoneEntry } from './zone-entry.entity';
import { programRelations } from './program-view';
import { standings } from './zone-standings';
import { renderVenueWorksheetPdf, type VenueWorksheetCategory, type VenueWorksheetMatch } from './venue-worksheet-pdf';

@Injectable()
export class TournamentVenuePdfService {
  constructor(
    @InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(Zone) private readonly zones: Repository<Zone>,
    @InjectRepository(ZoneEntry) private readonly entries: Repository<ZoneEntry>,
    @InjectRepository(TournamentScheduleSlot) private readonly slots: Repository<TournamentScheduleSlot>,
  ) {}

  async generate(tournamentId: number, venueId: number) {
    const [tournament, venue] = await Promise.all([this.tournaments.findOneBy({ id: tournamentId }), this.venues.findOneBy({ id: venueId })]);
    if (!tournament) throw new NotFoundException('Torneo no encontrado');
    if (!venue) throw new NotFoundException('Sede no encontrada');

    const [venueZones, allSlots] = await Promise.all([
      this.zones.find({ where: { venueId, tournamentCategory: { tournamentId } }, relations: { tournamentCategory: { category: true } }, order: { tournamentCategoryId: 'ASC', name: 'ASC' } }),
      this.slots.find({ where: { tournamentId }, relations: programRelations, order: { tournamentCategoryId: 'ASC', stage: 'ASC', matchOrder: 'ASC' } }),
    ]);
    const zoneIds = venueZones.map((zone) => zone.id);
    const entries = zoneIds.length ? await this.entries.find({ where: { zoneId: In(zoneIds) }, relations: { registration: { locality: true } }, order: { zoneId: 'ASC', seed: 'ASC' } }) : [];
    const categoryIds = new Set([
      ...venueZones.map((zone) => zone.tournamentCategoryId),
      ...allSlots.filter((slot) => slot.stage !== 'ZONE' && slot.court?.venueId === venueId).map((slot) => slot.tournamentCategoryId),
    ]);
    if (!categoryIds.size) throw new BadRequestException('La sede no tiene zonas ni partidos eliminatorios asignados en este torneo.');

    const sequenceByMatch = new Map(allSlots.flatMap((slot) => slot.matchId ? [[slot.matchId, slot.sequence] as const] : []));
    const zoneById = new Map(venueZones.map((zone) => [zone.id, zone]));
    const teamName = (registration: PairRegistration | null | undefined) => {
      if (!registration) return '';
      const players = `${registration.playerOneName} / ${registration.playerTwoName}`;
      const team = registration.representingText?.trim();
      return team && !players.toLocaleLowerCase('es').includes(team.toLocaleLowerCase('es')) ? `${team} · ${players}` : players;
    };
    const sourceLabel = (slot: TournamentScheduleSlot, side: 'home' | 'away') => {
      const match = slot.match;
      if (!match) return 'A definir';
      const qualifierZoneId = side === 'home' ? match.homeQualifierZoneId : match.awayQualifierZoneId;
      const qualifierRank = side === 'home' ? match.homeQualifierRank : match.awayQualifierRank;
      if (qualifierZoneId) return `${qualifierRank ?? 1}.ª de ${allSlots.find((item) => item.match?.zoneId === qualifierZoneId)?.zoneName ?? 'zona'}`;
      const sourceMatchId = side === 'home' ? match.homeSourceMatchId : match.awaySourceMatchId;
      const source = side === 'home' ? match.homeSource : match.awaySource;
      if (sourceMatchId) return `${source === 'LOSER' ? 'Perdedora' : 'Ganadora'} P${sequenceByMatch.get(sourceMatchId) ?? '?'}`;
      if (slot.stage === 'ZONE') {
        const zone = match.zoneId ? zoneById.get(match.zoneId) : undefined;
        const pairings = zone?.capacity === 3 ? [[1, 2], [1, 3], [2, 3]] : [[1, 2], [3, 4]];
        const pairing = pairings[match.matchOrder - 1];
        if (pairing) return `Pareja ${pairing[side === 'home' ? 0 : 1]}`;
      }
      return 'A definir';
    };
    const worksheetMatch = (slot: TournamentScheduleSlot): VenueWorksheetMatch => ({
      sequence: slot.sequence,
      matchOrder: slot.matchOrder,
      home: teamName(slot.match?.homeRegistration) || sourceLabel(slot, 'home'),
      away: teamName(slot.match?.awayRegistration) || sourceLabel(slot, 'away'),
      homeSource: sourceLabel(slot, 'home'),
      awaySource: sourceLabel(slot, 'away'),
      homeScore: slot.match?.homeScore ?? null,
      awayScore: slot.match?.awayScore ?? null,
      court: slot.court?.name ?? '',
      venue: slot.court?.venue?.name ?? '',
      scheduledAt: slot.scheduledAt,
      atWorksheetVenue: slot.court?.venueId === venueId,
    });

    const categories: VenueWorksheetCategory[] = [...categoryIds].map((categoryId) => {
      const categoryZones = venueZones.filter((zone) => zone.tournamentCategoryId === categoryId);
      const categorySlots = allSlots.filter((slot) => slot.tournamentCategoryId === categoryId);
      const name = categoryZones[0]?.tournamentCategory.category.name ?? categorySlots[0]?.tournamentCategory.category.name ?? `Categoría ${categoryId}`;
      const zones = categoryZones.map((zone) => {
        const zoneEntries = entries.filter((entry) => entry.zoneId === zone.id);
        const zoneSlots = categorySlots.filter((slot) => slot.stage === 'ZONE' && slot.match?.zoneId === zone.id).sort((left, right) => left.matchOrder - right.matchOrder);
        const rows = new Map(standings(zoneEntries, zoneSlots.flatMap((slot) => slot.match ? [slot.match] : [])).map((row) => [row.registrationId, row]));
        return {
          name: zone.name,
          teams: zoneEntries.map((entry) => {
            const row = rows.get(entry.registrationId);
            return { seed: entry.seed, name: teamName(entry.registration), players: `${entry.registration.playerOneName} / ${entry.registration.playerTwoName}`, played: row?.played ?? 0, wins: row?.wins ?? 0, pointsFor: row?.pointsFor ?? 0, pointsAgainst: row?.pointsAgainst ?? 0 };
          }),
          matches: zoneSlots.map(worksheetMatch),
        };
      });
      return {
        name,
        zones,
        knockout: {
          QUARTERFINAL: categorySlots.filter((slot) => slot.stage === 'QUARTERFINAL').sort((a, b) => a.matchOrder - b.matchOrder).map(worksheetMatch),
          SEMIFINAL: categorySlots.filter((slot) => slot.stage === 'SEMIFINAL').sort((a, b) => a.matchOrder - b.matchOrder).map(worksheetMatch),
          FINAL: categorySlots.filter((slot) => slot.stage === 'FINAL').sort((a, b) => a.matchOrder - b.matchOrder).map(worksheetMatch),
        },
      };
    }).sort((left, right) => left.name.localeCompare(right.name, 'es', { numeric: true }));
    const data = {
      tournamentName: tournament.name,
      venueName: venue.name,
      venueAddress: [venue.address, venue.city, venue.provinceName].filter(Boolean).join(', '),
      generatedAt: new Date(),
      categories,
    };
    const logoPath = this.logoPath();
    const buffer = await renderVenueWorksheetPdf(data, logoPath);
    return { buffer, fileName: `planilla-${this.slug(tournament.name)}-${this.slug(venue.name)}.pdf` };
  }

  private logoPath() {
    const candidates = [
      resolve(process.cwd(), '../frontend/dist/LogoFemme.png'),
      resolve(process.cwd(), '../frontend/public/LogoFemme.png'),
      resolve(process.cwd(), 'frontend/dist/LogoFemme.png'),
      resolve(process.cwd(), 'frontend/public/LogoFemme.png'),
    ];
    return candidates.find((candidate) => existsSync(candidate));
  }

  private slug(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'torneo';
  }
}
