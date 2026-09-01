import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './tournament.entity';
import { TournamentCategory } from './tournament-category.entity';
import { Zone } from './zone.entity';

@Injectable()
export class TournamentQueryService {
  constructor(@InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>, @InjectRepository(TournamentCategory) private readonly categories: Repository<TournamentCategory>, @InjectRepository(Zone) private readonly zones: Repository<Zone>) {}
  async detail(id: number) { const tournament = await this.tournaments.findOneBy({ id }); if (!tournament) throw new NotFoundException('Torneo no encontrado'); return { ...tournament, categories: await this.categories.find({ where: { tournamentId: id }, relations: { category: true } }), zones: await this.zones.find({ where: { tournamentCategory: { tournamentId: id } }, relations: { court: true, tournamentCategory: { category: true } } }) }; }
}
