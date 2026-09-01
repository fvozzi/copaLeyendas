import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './tournament.entity';
import { TournamentCategory } from './tournament-category.entity';
import { Zone } from './zone.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { ZoneEntry } from './zone-entry.entity';
import { RegistrationStatus } from '../registrations/registration.enums';

@Injectable()
export class TournamentQueryService {
  constructor(@InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>, @InjectRepository(TournamentCategory) private readonly categories: Repository<TournamentCategory>, @InjectRepository(Zone) private readonly zones: Repository<Zone>, @InjectRepository(ZoneEntry) private readonly entries: Repository<ZoneEntry>, @InjectRepository(PairRegistration) private readonly registrations: Repository<PairRegistration>) {}
  async detail(id: number) { const tournament = await this.tournaments.findOneBy({ id }); if (!tournament) throw new NotFoundException('Torneo no encontrado'); return { ...tournament, categories: await this.categories.find({ where: { tournamentId: id }, relations: { category: true } }), zones: await this.zones.find({ where: { tournamentCategory: { tournamentId: id } }, relations: { court: true, tournamentCategory: { category: true } } }) }; }
  async zone(id: number) { const zone = await this.zones.findOne({ where: { id }, relations: { court: true, tournamentCategory: { category: true } } }); if (!zone) throw new NotFoundException('Zona no encontrada'); return { ...zone, entries: await this.entries.find({ where: { zoneId: id }, relations: { registration: true }, order: { seed: 'ASC', id: 'ASC' } }) }; }
  async availableRegistrations(tournamentCategoryId: number) { const category = await this.categories.findOne({ where: { id: tournamentCategoryId }, relations: { category: true } }); if (!category) throw new NotFoundException('Categoria de torneo no encontrada'); const assigned = await this.entries.createQueryBuilder('entry').innerJoin('entry.zone', 'zone').where('zone.tournamentCategoryId = :id', { id: tournamentCategoryId }).select('entry.registrationId', 'id').getRawMany<{ id: number }>(); return this.registrations.createQueryBuilder('registration').where('registration.category = :category', { category: category.category.code }).andWhere('registration.status = :status', { status: RegistrationStatus.CONFIRMED }).andWhere(assigned.length ? 'registration.id NOT IN (:...ids)' : '1=1', { ids: assigned.map((item) => item.id) }).orderBy('registration.localityName', 'ASC').getMany(); }
}
