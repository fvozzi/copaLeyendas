import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { GoogleDrivePhotoStorageService } from '../registrations/google-drive-photo-storage.service';
import { resolvePaymentProofDir } from '../registrations/payment-proof-storage';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Not, Repository } from 'typeorm';
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
        content: toCsv(['ID', 'Nombre completo', 'DNI', 'Fecha nacimiento', 'Celular', 'Instagram', 'Marca / acuerdo', 'Talle camiseta', 'Localidad / equipo', 'Provincia', 'Fecha de alta', 'Ultima actualizacion'], players.map((player) => [player.id, player.fullName, player.dni, player.birthDate ?? '', player.phone ?? '', player.instagram ?? '', player.hasCommercialAgreement === null ? 'Sin datos' : player.hasCommercialAgreement ? player.commercialAgreementDetails ?? 'Marca no especificada' : 'Sin acuerdo', player.shirtSize ?? '', player.locality?.name ?? '', player.locality?.provinceName ?? '', player.createdAt.toISOString(), player.updatedAt.toISOString()])),
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
      relations: { category: true },
      order: { updatedAt: 'ASC', id: 'ASC' },
    });

    for (const registration of registrations) {
      await this.syncRegistrationPlayers(registration);
    }
    return registrations;
  }

  async syncRegistrationPlayers(registration: PairRegistration, correction?: { manager: EntityManager; previous: PairRegistration }) {
    if (correction) return this.correctRegistrationPlayers(registration, correction.previous, correction.manager);
    let locality: Locality | null = null;
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
      locality ??= await this.findOrCreateLocality(registration.localityName, registration.provinceName);

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

  private async correctRegistrationPlayers(registration: PairRegistration, previous: PairRegistration, manager: EntityManager) {
    const localities = manager.getRepository(Locality);
    const players = manager.getRepository(Player);
    let locality = await localities.findOne({ where: { name: registration.localityName, provinceName: registration.provinceName } });
    if (!locality) locality = await localities.save(localities.create({ name: registration.localityName, provinceName: registration.provinceName, active: true }));
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
        ...player, dni, fullName: name, localityId: locality.id,
        birthDate: registration[`${prefix}BirthDate`], phone: registration[`${prefix}Phone`],
        instagram: registration[`${prefix}Instagram`], shirtSize: registration[`${prefix}ShirtSize`],
      }));
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
