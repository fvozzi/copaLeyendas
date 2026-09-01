import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Locality } from '../localities/locality.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { QueryPlayersDto } from './dto/query-players.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Player } from './player.entity';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player) private readonly playersRepository: Repository<Player>,
    @InjectRepository(Locality) private readonly localitiesRepository: Repository<Locality>,
  ) {}

  async list(query: QueryPlayersDto) {
    const qb = this.playersRepository.createQueryBuilder('player').leftJoinAndSelect('player.locality', 'locality');
    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(new Brackets((inner) => {
        inner.where('LOWER(player.fullName) LIKE :term', { term })
          .orWhere('LOWER(player.dni) LIKE :term', { term })
          .orWhere('LOWER(COALESCE(locality.name, \'\')) LIKE :term', { term });
      }));
    }
    return qb.orderBy('player.fullName', 'ASC').getMany();
  }

  async getById(id: number) {
    const player = await this.playersRepository.findOne({ where: { id }, relations: { locality: true } });
    if (!player) throw new NotFoundException('Jugadora no encontrada');
    return player;
  }

  async create(dto: CreatePlayerDto) {
    const locality = await this.resolveLocality(dto.localityId);
    return this.playersRepository.save(this.playersRepository.create({
      fullName: dto.fullName.trim(), dni: dto.dni.trim(), birthDate: normalizeOptional(dto.birthDate),
      phone: normalizeOptional(dto.phone), instagram: normalizeOptional(dto.instagram), shirtSize: dto.shirtSize ?? null,
      localityId: locality?.id ?? null,
    }));
  }

  async update(id: number, dto: UpdatePlayerDto) {
    const player = await this.getById(id);
    if (dto.localityId !== undefined) player.localityId = (await this.resolveLocality(dto.localityId))?.id ?? null;
    if (dto.fullName !== undefined) player.fullName = dto.fullName.trim();
    if (dto.dni !== undefined) player.dni = dto.dni.trim();
    if (dto.birthDate !== undefined) player.birthDate = normalizeOptional(dto.birthDate);
    if (dto.phone !== undefined) player.phone = normalizeOptional(dto.phone);
    if (dto.instagram !== undefined) player.instagram = normalizeOptional(dto.instagram);
    if (dto.shirtSize !== undefined) player.shirtSize = dto.shirtSize;
    return this.playersRepository.save(player);
  }

  async remove(id: number) {
    await this.playersRepository.remove(await this.getById(id));
    return { success: true };
  }

  private async resolveLocality(localityId?: number | null) {
    if (!localityId) return null;
    const locality = await this.localitiesRepository.findOne({ where: { id: localityId } });
    if (!locality) throw new NotFoundException('Localidad no encontrada');
    return locality;
  }
}

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
