import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityCourtPlayerGroup } from './community-court-player-group.entity';
import { CommunityCourtPhoto } from './community-court-photo.entity';
import { readCommunityCourtPhoto, removeCommunityCourtPhoto, storeCommunityCourtPhoto } from './community-court-photo-storage';
import { CommunityCourt, CommunityCourtType, FrontonBackType, TrinquetShareMaterial } from './community-court.entity';
import { CreateCommunityCourtDto, QueryCommunityCourtsDto } from './court-directory.dto';

@Injectable()
export class CourtDirectoryService {
  private readonly geocodeCache = new Map<string, { latitude: number; longitude: number; displayName: string }>();
  private geocodeQueue = Promise.resolve();
  private nextGeocodeAt = 0;

  constructor(
    @InjectRepository(CommunityCourt) private readonly courts: Repository<CommunityCourt>,
    @InjectRepository(CommunityCourtPhoto) private readonly photos: Repository<CommunityCourtPhoto>,
  ) {}

  async list(query: QueryCommunityCourtsDto) {
    const courts = await this.courts.find({ where: { active: true }, relations: { playerGroups: true, photos: true }, order: { country: 'ASC', province: 'ASC', locality: 'ASC', name: 'ASC' } });
    const search = normalize(query.search ?? '');
    return courts.filter((court) => {
      if (search && !normalize([court.name, court.organizationType, court.locality, court.province, court.country, court.address, court.history, court.inaugurationDate, court.contactName].filter(Boolean).join(' ')).includes(search)) return false;
      if (query.country && court.country !== query.country) return false;
      if (query.courtType && court.courtType !== query.courtType) return false;
      if ((query.gender || query.age !== undefined) && !court.playerGroups.some((group) => (
        (!query.gender || group.gender === query.gender)
        && (query.age === undefined || ((group.minAge === null || group.minAge <= query.age) && (group.maxAge === null || group.maxAge >= query.age)))
      ))) return false;
      return true;
    }).map(publicCourt);
  }

  async create(dto: CreateCommunityCourtDto, photoFiles: Express.Multer.File[] = []) {
    for (const group of dto.playerGroups) {
      if (group.minAge !== undefined && group.maxAge !== undefined && group.minAge !== null && group.maxAge !== null && group.minAge > group.maxAge) {
        throw new BadRequestException('La edad mínima no puede ser mayor que la edad máxima.');
      }
    }
    const storedNames: string[] = [];
    try {
      for (const photo of photoFiles) storedNames.push(await storeCommunityCourtPhoto(photo.buffer));
    } catch {
      await Promise.all(storedNames.map(removeCommunityCourtPhoto));
      throw new BadRequestException('No pudimos procesar una de las fotos. Probá con imágenes JPG, PNG, WebP, HEIC o HEIF.');
    }
    const court = this.courts.create({
      name: dto.name.trim(), organizationType: dto.organizationType, country: dto.country.trim(), province: dto.province.trim(), locality: dto.locality.trim(),
      address: dto.address?.trim() || null, latitude: dto.latitude, longitude: dto.longitude,
      courtType: dto.courtType,
      trinquetShareMaterial: dto.courtType === CommunityCourtType.TRINQUET ? dto.trinquetShareMaterial ?? null : null,
      trinquetShareMaterialOther: dto.courtType === CommunityCourtType.TRINQUET && dto.trinquetShareMaterial === TrinquetShareMaterial.OTHER ? dto.trinquetShareMaterialOther?.trim() || null : null,
      frontonWallOrientation: dto.courtType === CommunityCourtType.FRONTON ? dto.frontonWallOrientation ?? null : null,
      frontonTambur: dto.courtType === CommunityCourtType.FRONTON ? dto.frontonTambur ?? null : null,
      frontonHasCacerola: dto.courtType === CommunityCourtType.FRONTON ? dto.frontonHasCacerola ?? false : null,
      frontonBackType: dto.courtType === CommunityCourtType.FRONTON ? dto.frontonBackType ?? null : null,
      frontonReboundMaterial: dto.courtType === CommunityCourtType.FRONTON && dto.frontonBackType === FrontonBackType.REBOUND ? dto.frontonReboundMaterial?.trim() || null : null,
      frontisFinish: dto.frontisFinish, courtColor: dto.courtColor, history: dto.history?.trim() || null, inaugurationDate: dto.inaugurationDate ?? null,
      contactName: dto.contactName?.trim() || null, contactPhone: dto.contactPhone?.trim() || null,
      contactEmail: dto.contactEmail?.trim().toLocaleLowerCase('en') || null, contactUrl: dto.contactUrl?.trim() || null,
      hasSchool: dto.hasSchool, hasCourtKeeper: dto.hasCourtKeeper,
      lengthMeters: dto.lengthMeters ?? null, widthMeters: dto.widthMeters ?? null, active: true,
      playerGroups: dto.playerGroups.map((group) => Object.assign(new CommunityCourtPlayerGroup(), {
        gender: group.gender, minAge: group.minAge ?? null, maxAge: group.maxAge ?? null, playerCount: group.playerCount,
      })),
      photos: photoFiles.map((photo, index) => Object.assign(new CommunityCourtPhoto(), {
        storedName: storedNames[index], originalName: photo.originalname.slice(0, 220), mimeType: 'image/jpeg', sortOrder: index,
      })),
    });
    try {
      return publicCourt(await this.courts.save(court));
    } catch (error) {
      await Promise.all(storedNames.map(removeCommunityCourtPhoto));
      throw error;
    }
  }

  async photo(courtId: number, photoId: number) {
    const photo = await this.photos.findOne({ where: { id: photoId, courtId }, relations: { court: true } });
    if (!photo?.court.active) throw new NotFoundException('Foto no encontrada.');
    try {
      return { buffer: await readCommunityCourtPhoto(photo.storedName), mimeType: photo.mimeType, originalName: photo.originalName };
    } catch {
      throw new NotFoundException('Foto no encontrada.');
    }
  }

  async geocode(query: string, countryCode?: string) {
    const normalizedQuery = query.trim();
    const normalizedCountryCode = countryCode?.trim().toLocaleLowerCase('en');
    const cacheKey = `${normalize(normalizedQuery)}|${normalizedCountryCode ?? ''}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached) return cached;

    const request = this.geocodeQueue.then(async () => {
      const waitMs = Math.max(0, this.nextGeocodeAt - Date.now());
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.nextGeocodeAt = Date.now() + 1_000;
      const parameters = new URLSearchParams({ q: normalizedQuery, format: 'jsonv2', limit: '1', addressdetails: '1', 'accept-language': 'es' });
      if (normalizedCountryCode) parameters.set('countrycodes', normalizedCountryCode);
      const baseUrl = process.env.NOMINATIM_BASE_URL?.trim() || 'https://nominatim.openstreetmap.org';
      let response: Response;
      try {
        response = await fetch(`${baseUrl.replace(/\/$/, '')}/search?${parameters.toString()}`, {
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'es',
            'User-Agent': process.env.NOMINATIM_USER_AGENT?.trim() || 'CopaLeyendas/1.0 (https://copaleyendas.com.ar)',
            Referer: 'https://copaleyendas.com.ar/',
          },
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new ServiceUnavailableException('El buscador de localidades no está disponible en este momento. Podés marcar la cancha manualmente en el mapa.');
      }
      if (!response.ok) throw new ServiceUnavailableException('El buscador de localidades no está disponible en este momento. Podés marcar la cancha manualmente en el mapa.');
      const [result] = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (!result || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lon))) throw new NotFoundException('No encontramos esa localidad. Probá agregando una dirección o marcala manualmente en el mapa.');
      const location = { latitude: Number(result.lat), longitude: Number(result.lon), displayName: result.display_name };
      if (this.geocodeCache.size >= 200) this.geocodeCache.delete(this.geocodeCache.keys().next().value as string);
      this.geocodeCache.set(cacheKey, location);
      return location;
    });
    this.geocodeQueue = request.then(() => undefined, () => undefined);
    return request;
  }
}

function publicCourt(court: CommunityCourt) {
  const playerGroups = [...(court.playerGroups ?? [])].sort((left, right) => left.gender.localeCompare(right.gender) || (left.minAge ?? -1) - (right.minAge ?? -1));
  return {
    id: court.id, name: court.name, organizationType: court.organizationType, country: court.country, province: court.province, locality: court.locality,
    address: court.address, latitude: Number(court.latitude), longitude: Number(court.longitude),
    courtType: court.courtType,
    trinquetShareMaterial: court.trinquetShareMaterial, trinquetShareMaterialOther: court.trinquetShareMaterialOther,
    frontonWallOrientation: court.frontonWallOrientation, frontonTambur: court.frontonTambur, frontonHasCacerola: court.frontonHasCacerola,
    frontonBackType: court.frontonBackType, frontonReboundMaterial: court.frontonReboundMaterial,
    frontisFinish: court.frontisFinish, courtColor: court.courtColor, history: court.history, inaugurationDate: court.inaugurationDate,
    contactName: court.contactName, contactPhone: court.contactPhone, contactEmail: court.contactEmail, contactUrl: court.contactUrl,
    hasSchool: court.hasSchool, hasCourtKeeper: court.hasCourtKeeper,
    lengthMeters: court.lengthMeters === null ? null : Number(court.lengthMeters), widthMeters: court.widthMeters === null ? null : Number(court.widthMeters),
    playerGroups: playerGroups.map(({ id, gender, minAge, maxAge, playerCount }) => ({ id, gender, minAge, maxAge, playerCount })),
    photos: [...(court.photos ?? [])].sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id).map((photo) => ({
      id: photo.id, url: `/api/public/court-directory/${court.id}/photos/${photo.id}`, originalName: photo.originalName,
    })),
    totalPlayers: playerGroups.reduce((total, group) => total + group.playerCount, 0), createdAt: court.createdAt,
  };
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}
