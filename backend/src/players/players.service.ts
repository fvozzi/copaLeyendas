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
    // Registrations synchronize their players when they are created or rectified.
    // Repeating that roster synchronization while listing silently undid manual
    // unassignments and recreated players that a director had explicitly deleted.
    const registrations = await this.registrationsRepository.find({
      relations: { category: true, locality: true },
      order: { updatedAt: 'ASC', id: 'ASC' },
    });
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
    const player = await this.playersRepository.save(this.playersRepository.create({
      fullName: dto.fullName.trim(), dni: dto.dni.trim(), birthDate: normalizeOptional(dto.birthDate),
      phone: normalizeOptional(dto.phone), instagram: normalizeOptional(dto.instagram), shirtSize: dto.shirtSize ?? null,
      shirtModel: dto.shirtModel ?? null,
      localityId: locality?.id ?? null,
    }));
    await this.synchronizeLocalityRoster(player.localityId);
    return player;
  }

  async update(id: number, dto: UpdatePlayerDto) {
    const player = await this.getById(id);
    const previousDni = player.dni.trim();
    const previousLocalityId = player.localityId;
    const nextLocalityId = dto.localityId === undefined ? previousLocalityId : dto.localityId;
    if (nextLocalityId !== previousLocalityId) await this.assertCanLeaveRegisteredRoster(player, previousLocalityId);
    if (dto.localityId !== undefined) {
      const locality = await this.resolveLocality(dto.localityId);
      // getById loads the relation. Keep both the FK and the relation in sync so
      // TypeORM cannot restore the previous locality object when localityId is null.
      player.localityId = locality?.id ?? null;
      player.locality = locality;
    }
    if (dto.fullName !== undefined) player.fullName = dto.fullName.trim();
    if (dto.dni !== undefined) player.dni = dto.dni.trim();
    if (dto.birthDate !== undefined) player.birthDate = normalizeOptional(dto.birthDate);
    if (dto.phone !== undefined) player.phone = normalizeOptional(dto.phone);
    if (dto.instagram !== undefined) player.instagram = normalizeOptional(dto.instagram);
    if (dto.shirtSize !== undefined) player.shirtSize = dto.shirtSize;
    if (dto.shirtModel !== undefined) player.shirtModel = dto.shirtModel;
    const saved = await this.playersRepository.save(player);
    await this.synchronizePlayerSnapshots(saved, previousDni);
    await this.synchronizeLocalityRoster(previousLocalityId);
    if (saved.localityId !== previousLocalityId) await this.synchronizeLocalityRoster(saved.localityId);
    return saved;
  }

  async remove(id: number) {
    const player = await this.getById(id);
    await this.assertCanLeaveRegisteredRoster(player, player.localityId);
    await this.playersRepository.remove(player);
    await this.synchronizeLocalityRoster(player.localityId);
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
    await this.synchronizeLocalityRoster(registration.localityId);
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

  /**
   * Player is the canonical identity record. Registration columns are retained as
   * an immutable-friendly intake snapshot, but every application edit refreshes
   * the matching snapshot so tournament views cannot drift from Players.
   */
  private async synchronizePlayerSnapshots(player: Player, previousDni = player.dni.trim()) {
    const registrations = await this.registrationsRepository.find({
      where: [
        { playerOneDni: previousDni }, { playerTwoDni: previousDni }, { playerThreeDni: previousDni },
        ...(previousDni === player.dni.trim() ? [] : [
          { playerOneDni: player.dni.trim() }, { playerTwoDni: player.dni.trim() }, { playerThreeDni: player.dni.trim() },
        ]),
      ],
    });
    for (const registration of registrations) {
      if (registration.localityId !== player.localityId) continue;
      let changed = false;
      for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
        if (registration[`${prefix}Dni`]?.trim() !== previousDni) continue;
        assignPlayerSnapshot(registration, prefix, player);
        changed = true;
      }
      if (changed) await this.registrationsRepository.save(registration);
    }
  }

  /**
   * Today a locality represents one team. When that team has one registration,
   * its current 2/3-player roster is also the pair roster. Existing positions are
   * preserved and a replacement fills the vacated position.
   */
  private async synchronizeLocalityRoster(localityId: number | null) {
    if (!localityId) return;
    const [players, registrations] = await Promise.all([
      this.playersRepository.find({ where: { localityId }, order: { id: 'ASC' } }),
      this.registrationsRepository.find({ where: { localityId }, order: { id: 'ASC' } }),
    ]);
    if (registrations.length !== 1 || players.length < 2 || players.length > 3) return;

    const registration = registrations[0];
    const metadata = registrationMetadataByDni(registration);
    const ordered: Array<Player | undefined> = Array(players.length);
    const available = new Map(players.map((player) => [player.dni.trim(), player]));
    for (const [index, prefix] of (['playerOne', 'playerTwo', 'playerThree'] as const).entries()) {
      if (index >= ordered.length) break;
      const player = available.get(registration[`${prefix}Dni`]?.trim() ?? '');
      if (!player) continue;
      ordered[index] = player;
      available.delete(player.dni.trim());
    }
    for (const player of available.values()) {
      const empty = ordered.findIndex((item) => !item);
      if (empty >= 0) ordered[empty] = player;
    }
    assignPlayerSnapshot(registration, 'playerOne', ordered[0]!);
    assignRegistrationMetadata(registration, 'playerOne', metadata.get(ordered[0]!.dni.trim()));
    assignPlayerSnapshot(registration, 'playerTwo', ordered[1]!);
    assignRegistrationMetadata(registration, 'playerTwo', metadata.get(ordered[1]!.dni.trim()));
    if (ordered[2]) {
      assignPlayerSnapshot(registration, 'playerThree', ordered[2]);
      assignRegistrationMetadata(registration, 'playerThree', metadata.get(ordered[2].dni.trim()));
    }
    else clearThirdPlayerSnapshot(registration);
    await this.registrationsRepository.save(registration);
  }

  private async assertCanLeaveRegisteredRoster(player: Player, localityId: number | null) {
    if (!localityId) return;
    const referenced = await this.registrationsRepository.count({
      where: [{ playerOneDni: player.dni }, { playerTwoDni: player.dni }, { playerThreeDni: player.dni }],
    });
    if (!referenced) return;
    const [remainingPlayers, registrations] = await Promise.all([
      this.playersRepository.count({ where: { localityId, id: Not(player.id) } }),
      this.registrationsRepository.count({ where: { localityId } }),
    ]);
    if (registrations === 1 && (remainingPlayers === 2 || remainingPlayers === 3)) return;
    throw new BadRequestException('La jugadora integra una pareja inscripta. Agregá primero su reemplazo al mismo equipo; luego podrás quitarla sin dejar el programa inconsistente.');
  }

}

type PlayerPrefix = 'playerOne' | 'playerTwo' | 'playerThree';
type RegistrationMetadata = {
  hasCommercialAgreement: boolean;
  commercialAgreementDetails: string | null;
  photoStoredName: string | null;
  photoOriginalName: string | null;
  photoMimeType: string | null;
  photoSizeBytes: number | null;
};

function assignPlayerSnapshot(registration: PairRegistration, prefix: PlayerPrefix, player: Player) {
  registration[`${prefix}Name`] = player.fullName.trim();
  registration[`${prefix}Dni`] = player.dni.trim();
  // These fields predate Players and are non-null for the first two positions.
  // Preserve the submitted value when a manually-created player has no value yet.
  if (player.birthDate) registration[`${prefix}BirthDate`] = player.birthDate;
  if (player.phone) registration[`${prefix}Phone`] = player.phone;
  registration[`${prefix}Instagram`] = player.instagram;
  if (player.shirtSize) registration[`${prefix}ShirtSize`] = player.shirtSize;
}

function registrationMetadataByDni(registration: PairRegistration) {
  const result = new Map<string, RegistrationMetadata>();
  for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
    const dni = registration[`${prefix}Dni`]?.trim();
    if (!dni) continue;
    result.set(dni, {
      hasCommercialAgreement: registration[`${prefix}HasCommercialAgreement`],
      commercialAgreementDetails: registration[`${prefix}CommercialAgreementDetails`],
      photoStoredName: registration[`${prefix}PhotoStoredName`],
      photoOriginalName: registration[`${prefix}PhotoOriginalName`],
      photoMimeType: registration[`${prefix}PhotoMimeType`],
      photoSizeBytes: registration[`${prefix}PhotoSizeBytes`],
    });
  }
  return result;
}

function assignRegistrationMetadata(registration: PairRegistration, prefix: PlayerPrefix, metadata?: RegistrationMetadata) {
  registration[`${prefix}HasCommercialAgreement`] = metadata?.hasCommercialAgreement ?? false;
  registration[`${prefix}CommercialAgreementDetails`] = metadata?.commercialAgreementDetails ?? null;
  registration[`${prefix}PhotoStoredName`] = metadata?.photoStoredName ?? null;
  registration[`${prefix}PhotoOriginalName`] = metadata?.photoOriginalName ?? null;
  registration[`${prefix}PhotoMimeType`] = metadata?.photoMimeType ?? null;
  registration[`${prefix}PhotoSizeBytes`] = metadata?.photoSizeBytes ?? null;
}

function clearThirdPlayerSnapshot(registration: PairRegistration) {
  registration.playerThreeName = null;
  registration.playerThreeDni = null;
  registration.playerThreeBirthDate = null;
  registration.playerThreePhone = null;
  registration.playerThreeInstagram = null;
  registration.playerThreeShirtSize = null;
  registration.playerThreeHasCommercialAgreement = false;
  registration.playerThreeCommercialAgreementDetails = null;
  registration.playerThreePhotoStoredName = null;
  registration.playerThreePhotoOriginalName = null;
  registration.playerThreePhotoMimeType = null;
  registration.playerThreePhotoSizeBytes = null;
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
