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
import { Court } from '../courts/court.entity';
import { matchView, programRelations } from './program-view';
import { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import { publicProgramView } from './public-program-view';
import { standings } from './zone-standings';

@Injectable()
export class TournamentQueryService {
  constructor(@InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>, @InjectRepository(TournamentCategory) private readonly categories: Repository<TournamentCategory>, @InjectRepository(Zone) private readonly zones: Repository<Zone>, @InjectRepository(ZoneEntry) private readonly entries: Repository<ZoneEntry>, @InjectRepository(PairRegistration) private readonly registrations: Repository<PairRegistration>, @InjectRepository(TournamentMatch) private readonly matches: Repository<TournamentMatch>, @InjectRepository(Court) private readonly courts: Repository<Court>) {}
  async detail(id: number) { const tournament = await this.tournaments.findOneBy({ id }); if (!tournament) throw new NotFoundException('Torneo no encontrado'); return { ...tournament, categories: await this.categories.find({ where: { tournamentId: id }, relations: { category: true } }), zones: await this.zones.find({ where: { tournamentCategory: { tournamentId: id } }, relations: { venue: true, tournamentCategory: { category: true } } }) }; }
  async zone(id: number) { const zone = await this.zones.findOne({ where: { id }, relations: { venue: true, tournamentCategory: { category: true } } }); if (!zone) throw new NotFoundException('Zona no encontrada'); return { ...zone, entries: await this.entries.find({ where: { zoneId: id }, relations: { registration: true }, order: { seed: 'ASC', id: 'ASC' } }) }; }
  async availableRegistrations(tournamentCategoryId: number) { const category = await this.categories.findOne({ where: { id: tournamentCategoryId } }); if (!category) throw new NotFoundException('Categoria de torneo no encontrada'); const assigned = await this.entries.createQueryBuilder('entry').innerJoin('entry.zone', 'zone').where('zone.tournamentCategoryId = :id', { id: tournamentCategoryId }).select('entry.registrationId', 'id').getRawMany<{ id: number }>(); return this.registrations.createQueryBuilder('registration').leftJoinAndSelect('registration.category', 'category').where('registration.categoryId = :categoryId', { categoryId: category.categoryId }).andWhere('registration.status = :status', { status: RegistrationStatus.CONFIRMED }).andWhere(assigned.length ? 'registration.id NOT IN (:...ids)' : '1=1', { ids: assigned.map((item) => item.id) }).orderBy('registration.localityName', 'ASC').getMany(); }
  async currentPublic() {
    const tournament = await this.tournaments.findOne({ where: { status: TournamentStatus.ACTIVE }, order: { startsAt: 'ASC', id: 'ASC' } });
    if (!tournament) return { tournament: null, courts: [] };

    const [zones, matches, courts] = await Promise.all([
      this.zones.find({ where: { tournamentCategory: { tournamentId: tournament.id } }, relations: { venue: true, tournamentCategory: { category: true } }, order: { name: 'ASC' } }),
      this.matches.find({ where: { zone: { tournamentCategory: { tournamentId: tournament.id } } }, relations: { zone: { tournamentCategory: { category: true } }, homeRegistration: true, awayRegistration: true, scheduleSlot: { court: { venue: true } } }, order: { zoneId: 'ASC', matchOrder: 'ASC' } }),
      this.courts.find({ where: { active: true }, order: { name: 'ASC' } }),
    ]);
    const entries = zones.length ? await this.entries.find({ where: zones.map((zone) => ({ zoneId: zone.id })), relations: { registration: true }, order: { seed: 'ASC', id: 'ASC' } }) : [];

    return {
      tournament: {
        ...tournament,
        zones: zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          category: zone.tournamentCategory.category.name,
          venue: zone.venue,
          court: zone.venue,
          standings: standings(entries.filter((entry) => entry.zoneId === zone.id), matches.filter((match) => match.zoneId === zone.id)),
          matches: matches.filter((match) => match.zoneId === zone.id).map((match) => matchView(match)),
        })),
      },
      courts,
    };
  }
  async currentPublicMap() {
    const tournament = await this.tournaments.findOne({ where: { status: TournamentStatus.ACTIVE }, order: { startsAt: 'ASC', id: 'ASC' } });
    if (!tournament) return { detail: null, slots: [] };
    const [detail, slots] = await Promise.all([
      this.detail(tournament.id),
      this.matches.manager.getRepository(TournamentScheduleSlot).find({
        where: { tournamentId: tournament.id }, relations: programRelations, order: { sequence: 'ASC' },
      }),
    ]);
    return publicProgramView(detail, slots);
  }
}
