import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Locality } from '../localities/locality.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { QueryPlayersDto } from './dto/query-players.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Player } from './player.entity';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player) private readonly playersRepository: Repository<Player>,
    @InjectRepository(Locality) private readonly localitiesRepository: Repository<Locality>,
    @InjectRepository(PairRegistration)
    private readonly registrationsRepository: Repository<PairRegistration>,
  ) {}

  async list(query: QueryPlayersDto) {
    await this.importRegisteredPlayers();
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

  async export(kind: string) {
    const players = await this.list({});
    if (kind === 'insurance') {
      return {
        filename: 'jugadoras-seguro.csv',
        content: toCsv(['Nombre completo', 'Fecha nacimiento', 'DNI'], players.map((player) => [player.fullName, player.birthDate ?? '', player.dni])),
      };
    }
    if (kind === 'full') {
      return {
        filename: 'jugadoras-completo.csv',
        content: toCsv(['ID', 'Nombre completo', 'DNI', 'Fecha nacimiento', 'Celular', 'Instagram', 'Talle camiseta', 'Localidad / equipo', 'Provincia', 'Fecha de alta', 'Ultima actualizacion'], players.map((player) => [player.id, player.fullName, player.dni, player.birthDate ?? '', player.phone ?? '', player.instagram ?? '', player.shirtSize ?? '', player.locality?.name ?? '', player.locality?.provinceName ?? '', player.createdAt.toISOString(), player.updatedAt.toISOString()])),
      };
    }
    throw new BadRequestException('Tipo de exportacion invalido');
  }

  private async resolveLocality(localityId?: number | null) {
    if (!localityId) return null;
    const locality = await this.localitiesRepository.findOne({ where: { id: localityId } });
    if (!locality) throw new NotFoundException('Localidad no encontrada');
    return locality;
  }

  private async importRegisteredPlayers() {
    const registrations = await this.registrationsRepository.find({
      order: { createdAt: 'ASC' },
    });

    for (const registration of registrations) {
      await this.syncRegistrationPlayers(registration);
    }
  }

  async syncRegistrationPlayers(registration: PairRegistration) {
    const locality = await this.findOrCreateLocality(
      registration.localityName,
      registration.provinceName,
    );
    const candidates = [
      {
        fullName: registration.playerOneName,
        dni: registration.playerOneDni,
        birthDate: registration.playerOneBirthDate,
        phone: registration.playerOnePhone,
        instagram: registration.playerOneInstagram,
        shirtSize: registration.playerOneShirtSize,
      },
      {
        fullName: registration.playerTwoName,
        dni: registration.playerTwoDni,
        birthDate: registration.playerTwoBirthDate,
        phone: registration.playerTwoPhone,
        instagram: registration.playerTwoInstagram,
        shirtSize: registration.playerTwoShirtSize,
      },
      registration.playerThreeName && registration.playerThreeDni
        ? {
            fullName: registration.playerThreeName,
            dni: registration.playerThreeDni,
            birthDate: registration.playerThreeBirthDate,
            phone: registration.playerThreePhone,
            instagram: registration.playerThreeInstagram,
            shirtSize: registration.playerThreeShirtSize,
          }
        : null,
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const dni = candidate.dni.trim();
      const exists = await this.playersRepository.findOne({ where: { dni } });
      if (exists) continue;

      await this.playersRepository.save(
        this.playersRepository.create({
          fullName: candidate.fullName.trim(),
          dni,
          birthDate: candidate.birthDate,
          phone: normalizeOptional(candidate.phone),
          instagram: normalizeOptional(candidate.instagram),
          shirtSize: candidate.shirtSize,
          localityId: locality.id,
        }),
      );
    }
  }

  private async findOrCreateLocality(name: string, provinceName: string) {
    const existing = await this.localitiesRepository.findOne({
      where: { name, provinceName },
    });
    if (existing) return existing;

    return this.localitiesRepository.save(
      this.localitiesRepository.create({ name, provinceName, active: true }),
    );
  }
}

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toCsv(headers: string[], rows: (string | number)[][]) {
  return [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
}
