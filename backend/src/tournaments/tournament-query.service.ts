import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './tournament.entity';
import { TournamentCategory } from './tournament-category.entity';
import { Zone } from './zone.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { ZoneEntry } from './zone-entry.entity';
import { RegistrationStatus } from '../registrations/registration.enums';
import { TournamentMatch } from './tournament-match.entity';
import { TournamentStatus } from './tournament.enums';

@Injectable()
export class TournamentQueryService {
  constructor(@InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>, @InjectRepository(TournamentCategory) private readonly categories: Repository<TournamentCategory>, @InjectRepository(Zone) private readonly zones: Repository<Zone>, @InjectRepository(ZoneEntry) private readonly entries: Repository<ZoneEntry>, @InjectRepository(PairRegistration) private readonly registrations: Repository<PairRegistration>, @InjectRepository(TournamentMatch) private readonly matches: Repository<TournamentMatch>) {}
  async detail(id: number) { const tournament = await this.tournaments.findOneBy({ id }); if (!tournament) throw new NotFoundException('Torneo no encontrado'); return { ...tournament, categories: await this.categories.find({ where: { tournamentId: id }, relations: { category: true } }), zones: await this.zones.find({ where: { tournamentCategory: { tournamentId: id } }, relations: { court: true, tournamentCategory: { category: true } } }) }; }
  async zone(id: number) { const zone = await this.zones.findOne({ where: { id }, relations: { court: true, tournamentCategory: { category: true } } }); if (!zone) throw new NotFoundException('Zona no encontrada'); return { ...zone, entries: await this.entries.find({ where: { zoneId: id }, relations: { registration: true }, order: { seed: 'ASC', id: 'ASC' } }) }; }
  async availableRegistrations(tournamentCategoryId: number) { const category = await this.categories.findOne({ where: { id: tournamentCategoryId }, relations: { category: true } }); if (!category) throw new NotFoundException('Categoria de torneo no encontrada'); const assigned = await this.entries.createQueryBuilder('entry').innerJoin('entry.zone', 'zone').where('zone.tournamentCategoryId = :id', { id: tournamentCategoryId }).select('entry.registrationId', 'id').getRawMany<{ id: number }>(); return this.registrations.createQueryBuilder('registration').where('registration.category = :category', { category: category.category.code }).andWhere('registration.status = :status', { status: RegistrationStatus.CONFIRMED }).andWhere(assigned.length ? 'registration.id NOT IN (:...ids)' : '1=1', { ids: assigned.map((item) => item.id) }).orderBy('registration.localityName', 'ASC').getMany(); }
  async currentPublic() {
    const tournament = await this.tournaments.findOne({ where: { status: TournamentStatus.ACTIVE }, order: { startsAt: 'ASC', id: 'ASC' } });
    if (!tournament) return { tournament: null, courts: [] };

    const [zones, matches] = await Promise.all([
      this.zones.find({ where: { tournamentCategory: { tournamentId: tournament.id } }, relations: { court: true, tournamentCategory: { category: true } }, order: { name: 'ASC' } }),
      this.matches.find({ where: { zone: { tournamentCategory: { tournamentId: tournament.id } } }, relations: { zone: { tournamentCategory: { category: true } }, homeRegistration: true, awayRegistration: true }, order: { zoneId: 'ASC', matchOrder: 'ASC' } }),
    ]);
    const entries = zones.length ? await this.entries.find({ where: zones.map((zone) => ({ zoneId: zone.id })), relations: { registration: true }, order: { seed: 'ASC', id: 'ASC' } }) : [];
    const courts = uniqueCourts(zones.filter((zone) => zone.court.active).map((zone) => zone.court));

    return {
      tournament: {
        ...tournament,
        zones: zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          category: zone.tournamentCategory.category.name,
          court: zone.court,
          standings: standings(entries.filter((entry) => entry.zoneId === zone.id), matches.filter((match) => match.zoneId === zone.id)),
          matches: matches.filter((match) => match.zoneId === zone.id),
        })),
      },
      courts,
    };
  }
}

function uniqueCourts(courts: { id: number }[]) { return courts.filter((court, index) => courts.findIndex((item) => item.id === court.id) === index); }

function standings(entries: ZoneEntry[], matches: TournamentMatch[]) {
  const rows = new Map(entries.map((entry) => [entry.registrationId, { registration: entry.registration, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, tablePoints: 0 }]));
  for (const match of matches) {
    if (match.homeScore === null || match.awayScore === null || !match.homeRegistrationId || !match.awayRegistrationId) continue;
    const home = rows.get(match.homeRegistrationId); const away = rows.get(match.awayRegistrationId);
    if (!home || !away) continue;
    home.played += 1; away.played += 1; home.pointsFor += match.homeScore; home.pointsAgainst += match.awayScore; away.pointsFor += match.awayScore; away.pointsAgainst += match.homeScore;
    if (match.homeScore > match.awayScore) { home.wins += 1; home.tablePoints += 2; away.losses += 1; } else { away.wins += 1; away.tablePoints += 2; home.losses += 1; }
  }
  return [...rows.values()].sort((a, b) => b.tablePoints - a.tablePoints || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) || b.pointsFor - a.pointsFor);
}
