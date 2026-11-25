import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityCourtPlayerGroup } from './community-court-player-group.entity';
import { CommunityCourt, CommunityCourtType, FrontonBackType, TrinquetShareMaterial } from './community-court.entity';
import { CreateCommunityCourtDto, QueryCommunityCourtsDto } from './court-directory.dto';

@Injectable()
export class CourtDirectoryService {
  constructor(@InjectRepository(CommunityCourt) private readonly courts: Repository<CommunityCourt>) {}

  async list(query: QueryCommunityCourtsDto) {
    const courts = await this.courts.find({ where: { active: true }, relations: { playerGroups: true }, order: { country: 'ASC', province: 'ASC', locality: 'ASC', name: 'ASC' } });
    const search = normalize(query.search ?? '');
    return courts.filter((court) => {
      if (search && !normalize([court.name, court.locality, court.province, court.country, court.address].filter(Boolean).join(' ')).includes(search)) return false;
      if (query.country && court.country !== query.country) return false;
      if (query.courtType && court.courtType !== query.courtType) return false;
      if ((query.gender || query.age !== undefined) && !court.playerGroups.some((group) => (
        (!query.gender || group.gender === query.gender)
        && (query.age === undefined || ((group.minAge === null || group.minAge <= query.age) && (group.maxAge === null || group.maxAge >= query.age)))
      ))) return false;
      return true;
    }).map(publicCourt);
  }

  async create(dto: CreateCommunityCourtDto) {
    for (const group of dto.playerGroups) {
      if (group.minAge !== undefined && group.maxAge !== undefined && group.minAge !== null && group.maxAge !== null && group.minAge > group.maxAge) {
        throw new BadRequestException('La edad mínima no puede ser mayor que la edad máxima.');
      }
    }
    const court = this.courts.create({
      name: dto.name.trim(), country: dto.country.trim(), province: dto.province.trim(), locality: dto.locality.trim(),
      address: dto.address?.trim() || null, latitude: dto.latitude, longitude: dto.longitude,
      courtType: dto.courtType,
      trinquetShareMaterial: dto.courtType === CommunityCourtType.TRINQUET ? dto.trinquetShareMaterial ?? null : null,
      trinquetShareMaterialOther: dto.courtType === CommunityCourtType.TRINQUET && dto.trinquetShareMaterial === TrinquetShareMaterial.OTHER ? dto.trinquetShareMaterialOther?.trim() || null : null,
      frontonWallOrientation: dto.courtType === CommunityCourtType.FRONTON ? dto.frontonWallOrientation ?? null : null,
      frontonHasCacerola: dto.courtType === CommunityCourtType.FRONTON ? dto.frontonHasCacerola ?? false : null,
      frontonBackType: dto.courtType === CommunityCourtType.FRONTON ? dto.frontonBackType ?? null : null,
      frontonReboundMaterial: dto.courtType === CommunityCourtType.FRONTON && dto.frontonBackType === FrontonBackType.REBOUND ? dto.frontonReboundMaterial?.trim() || null : null,
      lengthMeters: dto.lengthMeters ?? null, widthMeters: dto.widthMeters ?? null, active: true,
      playerGroups: dto.playerGroups.map((group) => Object.assign(new CommunityCourtPlayerGroup(), {
        gender: group.gender, minAge: group.minAge ?? null, maxAge: group.maxAge ?? null, playerCount: group.playerCount,
      })),
    });
    return publicCourt(await this.courts.save(court));
  }
}

function publicCourt(court: CommunityCourt) {
  const playerGroups = [...(court.playerGroups ?? [])].sort((left, right) => left.gender.localeCompare(right.gender) || (left.minAge ?? -1) - (right.minAge ?? -1));
  return {
    id: court.id, name: court.name, country: court.country, province: court.province, locality: court.locality,
    address: court.address, latitude: Number(court.latitude), longitude: Number(court.longitude),
    courtType: court.courtType,
    trinquetShareMaterial: court.trinquetShareMaterial, trinquetShareMaterialOther: court.trinquetShareMaterialOther,
    frontonWallOrientation: court.frontonWallOrientation, frontonHasCacerola: court.frontonHasCacerola,
    frontonBackType: court.frontonBackType, frontonReboundMaterial: court.frontonReboundMaterial,
    lengthMeters: court.lengthMeters === null ? null : Number(court.lengthMeters), widthMeters: court.widthMeters === null ? null : Number(court.widthMeters),
    playerGroups: playerGroups.map(({ id, gender, minAge, maxAge, playerCount }) => ({ id, gender, minAge, maxAge, playerCount })),
    totalPlayers: playerGroups.reduce((total, group) => total + group.playerCount, 0), createdAt: court.createdAt,
  };
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}
