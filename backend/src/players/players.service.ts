import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { GoogleDrivePhotoStorageService } from '../registrations/google-drive-photo-storage.service';
import { resolvePaymentProofDir } from '../registrations/payment-proof-storage';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { Locality } from '../localities/locality.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { QueryPlayersDto } from './dto/query-players.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Player } from './player.entity';
import { distributeShirts, type ShirtZoneEntry } from '../dashboard/shirt-distribution';
import { Tournament } from '../tournaments/tournament.entity';
import { TournamentStatus } from '../tournaments/tournament.enums';
import { Zone } from '../tournaments/zone.entity';
import { ZoneEntry } from '../tournaments/zone-entry.entity';
import { ShirtModel } from './shirt-model';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player) private readonly playersRepository: Repository<Player>,
    @InjectRepository(Locality) private readonly localitiesRepository: Repository<Locality>,
    @InjectRepository(PairRegistration)
    private readonly registrationsRepository: Repository<PairRegistration>,
    @InjectRepository(Tournament) private readonly tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Zone) private readonly zonesRepository: Repository<Zone>,
    @InjectRepository(ZoneEntry) private readonly zoneEntriesRepository: Repository<ZoneEntry>,
    private readonly drivePhotos: GoogleDrivePhotoStorageService,
  ) {}

  async list(query: QueryPlayersDto) {
    const registrations = await this.importRegisteredPlayers();
    const qb = this.playersRepository.createQueryBuilder('player')
      .leftJoinAndSelect('player.locality', 'locality')
      .leftJoinAndSelect('locality.category', 'category');
    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(new Brackets((inner) => {
        inner.where('LOWER(player.fullName) LIKE :term', { term })
          .orWhere('LOWER(player.dni) LIKE :term', { term })
          .orWhere('LOWER(COALESCE(locality.name, \'\')) LIKE :term', { term });
      }));
    }
    const photos = registeredPhotos(registrations);
    const agreements = registeredAgreements(registrations);
    const categories = registeredCategories(registrations);
    const players = await qb.orderBy('player.fullName', 'ASC').getMany();
    await this.getShirtDistribution(registrations, await this.getShirtZoneEntries(), players);
    return players.map((player) => ({
      ...player, hasPhoto: photos.has(player.dni.trim()),
      categoryName: categories.get(player.dni.trim()) ?? player.locality?.category?.name ?? null,
      ...(agreements.get(player.dni.trim()) ?? { hasCommercialAgreement: null, commercialAgreementDetails: null }),
    }));
  }

  async getPhoto(id: number) {
    const player = await this.getById(id);
    const registrations = await this.registrationsRepository.find({
      where: [{ playerOneDni: player.dni }, { playerTwoDni: player.dni }, { playerThreeDni: player.dni }],
      order: { updatedAt: 'ASC', id: 'ASC' },
    });
    const photo = registeredPhotos(registrations).get(player.dni.trim());
    if (!photo) throw new NotFoundException('La jugadora no tiene foto');
    const contentType = ['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType ?? '') ? photo.contentType! : 'application/octet-stream';
    if (photo.storedName.startsWith('drive:')) {
      return { filename: photo.filename, contentType, stream: new StreamableFile(await this.drivePhotos.download(photo.storedName)) };
    }
    if (basename(photo.storedName) !== photo.storedName) throw new NotFoundException('Foto no encontrada');
    const path = join(resolvePaymentProofDir(), photo.storedName);
    if (!existsSync(path)) throw new NotFoundException('El archivo de la foto no esta disponible');
    return { filename: photo.filename, contentType, stream: new StreamableFile(createReadStream(path)) };
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
      shirtModel: dto.shirtModel ?? null,
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
    if (dto.shirtModel !== undefined) player.shirtModel = dto.shirtModel;
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
        content: toCsv(['ID', 'Nombre completo', 'DNI', 'Fecha nacimiento', 'Celular', 'Instagram', 'Marca / acuerdo', 'Talle camiseta', 'Modelo asignado', 'Localidad / equipo', 'Provincia', 'Fecha de alta', 'Ultima actualizacion'], players.map((player) => [player.id, player.fullName, player.dni, player.birthDate ?? '', player.phone ?? '', player.instagram ?? '', player.hasCommercialAgreement === null ? 'Sin datos' : player.hasCommercialAgreement ? player.commercialAgreementDetails ?? 'Marca no especificada' : 'Sin acuerdo', player.shirtSize ?? '', player.shirtModel ?? '', player.locality?.name ?? '', player.locality?.provinceName ?? '', player.createdAt.toISOString(), player.updatedAt.toISOString()])),
      };
    }
    throw new BadRequestException('Tipo de exportacion invalido');
  }

  async getShirtDistribution(registrations: PairRegistration[], zoneEntries: ShirtZoneEntry[], players?: Player[]) {
    const currentPlayers = players ?? await this.playersRepository.find();
    const savedAssignments = new Map(currentPlayers
      .filter((player): player is Player & { shirtModel: ShirtModel } => Boolean(player.shirtModel))
      .map((player) => [player.dni.trim(), player.shirtModel]));
    const distribution = distributeShirts(registrations, zoneEntries, savedAssignments);
    const computedAssignments = shirtModelsByDni(distribution);
    for (const player of currentPlayers) {
      if (player.shirtModel) continue;
      const shirtModel = computedAssignments.get(player.dni.trim());
      if (!shirtModel) continue;
      const updated = await this.playersRepository.update({ id: player.id, shirtModel: IsNull() }, { shirtModel });
      if (updated.affected !== 0) player.shirtModel = shirtModel;
    }
    return distribution;
  }

  private async resolveLocality(localityId?: number | null) {
    if (!localityId) return null;
    const locality = await this.localitiesRepository.findOne({ where: { id: localityId } });
    if (!locality) throw new NotFoundException('Localidad no encontrada');
    return locality;
  }

  private async importRegisteredPlayers() {
    const registrations = await this.registrationsRepository.find({
      relations: { category: true, locality: true },
      order: { updatedAt: 'ASC', id: 'ASC' },
    });

    const latestRegistrationByDni = new Map<string, number>();
    for (const registration of registrations) {
      for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
        const dni = registration[`${prefix}Dni`]?.trim();
        if (dni) latestRegistrationByDni.set(dni, registration.id);
      }
    }
    for (const registration of registrations) {
      const authoritativeDnis = new Set([...latestRegistrationByDni]
        .filter(([, registrationId]) => registrationId === registration.id)
        .map(([dni]) => dni));
      await this.syncRegistrationPlayers(registration, undefined, authoritativeDnis);
    }
    return registrations;
  }

  private async getShirtZoneEntries(): Promise<ShirtZoneEntry[]> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { status: TournamentStatus.ACTIVE }, order: { startsAt: 'ASC', id: 'ASC' },
    });
    if (!tournament) return [];
    const zones = await this.zonesRepository.find({
      where: { tournamentCategory: { tournamentId: tournament.id } },
      relations: { tournamentCategory: true },
    });
    if (!zones.length) return [];
    const entries = await this.zoneEntriesRepository.find({ where: zones.map((zone) => ({ zoneId: zone.id })) });
    const zonesById = new Map(zones.map((zone) => [zone.id, zone]));
    return entries.flatMap((entry) => {
      const zone = zonesById.get(entry.zoneId);
      return zone ? [{
        registrationId: entry.registrationId, zoneId: zone.id, zoneName: zone.name,
        categoryId: zone.tournamentCategory.categoryId, seed: entry.seed,
      }] : [];
    });
  }

  async syncRegistrationPlayers(registration: PairRegistration, correction?: { manager: EntityManager; previous: PairRegistration }, authoritativeDnis?: ReadonlySet<string>) {
    if (correction) return this.correctRegistrationPlayers(registration, correction.previous, correction.manager);
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
      if (exists) {
        if ((!authoritativeDnis || authoritativeDnis.has(dni)) && exists.localityId !== registration.localityId) {
          exists.localityId = registration.localityId;
          await this.playersRepository.save(exists);
        }
        continue;
      }

      await this.playersRepository.save(
        this.playersRepository.create({
          fullName: candidate.fullName.trim(),
          dni,
          birthDate: candidate.birthDate,
          phone: normalizeOptional(candidate.phone),
          instagram: normalizeOptional(candidate.instagram),
          shirtSize: candidate.shirtSize,
          localityId: registration.localityId,
        }),
      );
    }
  }

  private async correctRegistrationPlayers(registration: PairRegistration, previous: PairRegistration, manager: EntityManager) {
    const players = manager.getRepository(Player);
    const prefixes = ['playerOne', 'playerTwo', 'playerThree'] as const;
    const currentDnis = prefixes.map((prefix) => registration[`${prefix}Dni`]?.trim()).filter(Boolean);
    for (const prefix of prefixes) {
      const dni = registration[`${prefix}Dni`]?.trim();
      const name = registration[`${prefix}Name`]?.trim();
      if (!dni || !name) continue;
      let player = await players.findOne({ where: { dni } });
      const oldDni = previous[`${prefix}Dni`]?.trim();
      // A corrected DNI keeps its player ID unless that identity is still used elsewhere.
      if (!player && oldDni && oldDni !== dni && !currentDnis.includes(oldDni)) {
        const otherRegistrations = await manager.count(PairRegistration, { where: prefixes.map((key) => ({ id: Not(registration.id), [`${key}Dni`]: oldDni })) });
        if (!otherRegistrations) player = await players.findOne({ where: { dni: oldDni } });
      }
      await players.save(players.create({
        ...player, dni, fullName: name, localityId: registration.localityId,
        birthDate: registration[`${prefix}BirthDate`], phone: registration[`${prefix}Phone`],
        instagram: registration[`${prefix}Instagram`], shirtSize: registration[`${prefix}ShirtSize`],
      }));
    }
  }

}

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function registeredCategories(registrations: PairRegistration[]) {
  const categories = new Map<string, string>();
  for (const registration of registrations) {
    if (!registration.category?.name) continue;
    for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
      const dni = registration[`${prefix}Dni`]?.trim();
      if (dni && registration[`${prefix}Name`]?.trim()) categories.set(dni, registration.category.name);
    }
  }
  return categories;
}

function shirtModelsByDni(distribution: ReturnType<typeof distributeShirts>) {
  const assignments = new Map<string, { registrationId: number; model: ShirtModel }>();
  for (const model of distribution.models) {
    for (const player of model.players) {
      if (!player.dni) continue;
      const current = assignments.get(player.dni);
      if (!current || player.registrationId >= current.registrationId) {
        assignments.set(player.dni, { registrationId: player.registrationId, model: model.name });
      }
    }
  }
  return new Map([...assignments].map(([dni, assignment]) => [dni, assignment.model]));
}

function registeredAgreements(registrations: PairRegistration[]) {
  const agreements = new Map<string, { hasCommercialAgreement: boolean | null; commercialAgreementDetails: string | null }>();
  // Order by last update, so a rectification is the latest declaration for that DNI.
  for (const registration of registrations) {
    for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
      const dni = registration[`${prefix}Dni`]?.trim();
      if (!dni || !registration[`${prefix}Name`]?.trim()) continue;
      const hasAgreement = registration[`${prefix}HasCommercialAgreement`] ?? null;
      agreements.set(dni, {
        hasCommercialAgreement: hasAgreement,
        commercialAgreementDetails: hasAgreement ? normalizeOptional(registration[`${prefix}CommercialAgreementDetails`]) : null,
      });
    }
  }
  return agreements;
}

function registeredPhotos(registrations: PairRegistration[]) {
  const photos = new Map<string, { storedName: string; filename: string; contentType: string | null }>();
  for (const registration of registrations) {
    for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
      const dni = registration[`${prefix}Dni`]?.trim();
      const storedName = registration[`${prefix}PhotoStoredName`];
      if (dni && registration[`${prefix}Name`]?.trim() && storedName) photos.set(dni, {
        storedName, filename: registration[`${prefix}PhotoOriginalName`] || 'foto-jugadora',
        contentType: registration[`${prefix}PhotoMimeType`],
      });
    }
  }
  return photos;
}

function toCsv(headers: string[], rows: (string | number)[][]) {
  return [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
}
