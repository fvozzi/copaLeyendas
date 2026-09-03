import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CreatePublicRegistrationDto } from './dto/create-public-registration.dto';
import { CreateAccessGrantDto } from './dto/create-access-grant.dto';
import { ensurePaymentProofDir } from './payment-proof-storage';
import { QueryAccessGrantsDto } from './dto/query-access-grants.dto';
import { QueryRegistrationsDto } from './dto/query-registrations.dto';
import { UpdateAccessGrantStatusDto } from './dto/update-access-grant-status.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import {
  HeardAboutSource,
  RegistrationStatus,
  RegistrationAccessGrantStatus,
} from './registration.enums';
import { PairRegistration } from './pair-registration.entity';
import { RegistrationAccessGrant } from './registration-access-grant.entity';
import { Locality } from '../localities/locality.entity';
import { PlayersService } from '../players/players.service';

interface RegistrationFiles {
  paymentProof?: Express.Multer.File;
  playerOnePhoto?: Express.Multer.File;
  playerTwoPhoto?: Express.Multer.File;
  playerThreePhoto?: Express.Multer.File;
}

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(PairRegistration)
    private readonly registrationsRepository: Repository<PairRegistration>,
    @InjectRepository(RegistrationAccessGrant)
    private readonly accessGrantsRepository: Repository<RegistrationAccessGrant>,
    @InjectRepository(Locality)
    private readonly localitiesRepository: Repository<Locality>,
    private readonly playersService: PlayersService,
  ) {}

  async createAccessGrant(dto: CreateAccessGrantDto) {
    const token = await this.generateUniqueToken();
    const locality = dto.localityId
      ? await this.localitiesRepository.findOne({ where: { id: dto.localityId }, relations: { category: true } })
      : null;
    if (dto.localityId && !locality) throw new NotFoundException('Localidad no encontrada');
    if (locality && (!locality.active || !locality.category || !locality.category.active)) {
      throw new BadRequestException('La localidad debe tener una categoria activa para habilitarse');
    }
    const localityName = locality?.name ?? dto.localityName?.trim() ?? '';
    const grant = this.accessGrantsRepository.create({
      token,
      category: locality?.category?.code ?? dto.category,
      localityName,
      provinceName: locality?.provinceName ?? dto.provinceName?.trim() ?? '',
      clubName: normalizeOptional(dto.clubName) ?? localityName,
      contactName: normalizeOptional(dto.contactName),
      contactEmail: normalizeOptional(dto.contactEmail),
      contactPhone: normalizeOptional(dto.contactPhone),
      notes: normalizeOptional(dto.notes),
      feeWaived: dto.feeWaived ?? false,
      status: RegistrationAccessGrantStatus.ACTIVE,
      consumedAt: null,
    });

    return this.accessGrantsRepository.save(grant);
  }

  async listAccessGrants(query: QueryAccessGrantsDto) {
    const qb = this.accessGrantsRepository.createQueryBuilder('grant');

    if (query.category) {
      qb.andWhere('grant.category = :category', { category: query.category });
    }

    if (query.status) {
      qb.andWhere('grant.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((inner) => {
          inner
            .where('LOWER(grant.localityName) LIKE :term', { term })
            .orWhere('LOWER(grant.provinceName) LIKE :term', { term })
            .orWhere('LOWER(grant.clubName) LIKE :term', { term })
            .orWhere('LOWER(grant.token) LIKE :term', { term });
        }),
      );
    }

    qb.orderBy('grant.createdAt', 'DESC');

    return qb.getMany();
  }

  async updateAccessGrantStatus(id: number, dto: UpdateAccessGrantStatusDto) {
    const grant = await this.accessGrantsRepository.findOne({ where: { id } });

    if (!grant) {
      throw new NotFoundException('Access grant not found');
    }

    if (grant.status === RegistrationAccessGrantStatus.USED) {
      throw new BadRequestException('Used token cannot change status');
    }

    grant.status = dto.status;
    return this.accessGrantsRepository.save(grant);
  }

  async removeAccessGrant(id: number) {
    const grant = await this.accessGrantsRepository.findOne({ where: { id } });

    if (!grant) {
      throw new NotFoundException('Equipo habilitado no encontrado');
    }

    const registrationsCount = await this.registrationsRepository.count({
      where: { accessGrantId: id },
    });

    if (registrationsCount > 0) {
      throw new BadRequestException('Primero debe eliminar el registro asociado a este equipo');
    }

    await this.accessGrantsRepository.remove(grant);
    return { success: true };
  }

  async getPublicAccessGrant(token: string) {
    const grant = await this.findAccessGrantByToken(token);

    return {
      id: grant.id,
      token: grant.token,
      category: grant.category,
      localityName: grant.localityName,
      provinceName: grant.provinceName,
      clubName: grant.clubName,
      contactName: grant.contactName,
      contactEmail: grant.contactEmail,
      contactPhone: grant.contactPhone,
      notes: grant.notes,
      feeWaived: grant.feeWaived,
      status: grant.status,
      enabled: grant.status === RegistrationAccessGrantStatus.ACTIVE,
    };
  }

  async createPublic(dto: CreatePublicRegistrationDto, files: RegistrationFiles = {}) {
    ensurePaymentProofDir();
    const { paymentProof, playerOnePhoto, playerTwoPhoto, playerThreePhoto } = files;
    const grant = await this.findAccessGrantByToken(dto.accessToken);

    if (grant.status !== RegistrationAccessGrantStatus.ACTIVE) {
      this.cleanupUploadedFiles(files);
      throw new BadRequestException('Token no disponible para nuevas inscripciones');
    }

    const existingCount = await this.registrationsRepository.count({
      where: { accessGrantId: grant.id },
    });

    if (existingCount > 0) {
      this.cleanupUploadedFiles(files);
      throw new BadRequestException('Este token ya fue utilizado');
    }

    if (!dto.tournamentAvailabilityConfirmed) {
      this.cleanupUploadedFiles(files);
      throw new BadRequestException('Debe confirmar disponibilidad para las fechas del torneo');
    }

    if (dto.heardAboutSource === HeardAboutSource.OTHER && !dto.heardAboutOtherText?.trim()) {
      this.cleanupUploadedFiles(files);
      throw new BadRequestException('Debe indicar como se entero del evento');
    }

    if (!grant.feeWaived && !paymentProof) {
      this.cleanupUploadedFiles(files);
      throw new BadRequestException('Debe adjuntar el comprobante de pago');
    }

    if (!playerOnePhoto || !playerTwoPhoto) {
      this.cleanupUploadedFiles(files);
      throw new BadRequestException('Debe adjuntar una foto de la jugadora 1 y de la jugadora 2');
    }

    if (dto.playerThreeName?.trim() && !playerThreePhoto) {
      this.cleanupUploadedFiles(files);
      throw new BadRequestException('Debe adjuntar una foto de la jugadora 3');
    }

    const registration = this.registrationsRepository.create({
      accessGrantId: grant.id,
      category: grant.category,
      localityName: grant.localityName,
      provinceName: grant.provinceName,
      clubName: grant.clubName,
      heardAboutSource: dto.heardAboutSource,
      heardAboutOtherText: normalizeOptional(dto.heardAboutOtherText),
      tournamentAvailabilityConfirmed: dto.tournamentAvailabilityConfirmed,
      representingText: dto.representingText.trim(),
      contactEmail: normalizeOptional(dto.contactEmail),
      feeWaived: grant.feeWaived,
      playerOneName: dto.playerOneName.trim(),
      playerOneDni: dto.playerOneDni.trim(),
      playerOneBirthDate: dto.playerOneBirthDate,
      playerOnePhone: dto.playerOnePhone.trim(),
      playerOneInstagram: normalizeOptional(dto.playerOneInstagram),
      playerOneShirtSize: dto.playerOneShirtSize,
      playerOneHasCommercialAgreement: dto.playerOneHasCommercialAgreement,
      playerOneCommercialAgreementDetails: normalizeOptional(dto.playerOneCommercialAgreementDetails),
      playerOnePhotoStoredName: playerOnePhoto.filename,
      playerOnePhotoOriginalName: playerOnePhoto.originalname,
      playerOnePhotoMimeType: playerOnePhoto.mimetype,
      playerOnePhotoSizeBytes: playerOnePhoto.size,
      playerTwoName: dto.playerTwoName.trim(),
      playerTwoDni: dto.playerTwoDni.trim(),
      playerTwoBirthDate: dto.playerTwoBirthDate,
      playerTwoPhone: dto.playerTwoPhone.trim(),
      playerTwoInstagram: normalizeOptional(dto.playerTwoInstagram),
      playerTwoShirtSize: dto.playerTwoShirtSize,
      playerTwoHasCommercialAgreement: dto.playerTwoHasCommercialAgreement,
      playerTwoCommercialAgreementDetails: normalizeOptional(dto.playerTwoCommercialAgreementDetails),
      playerTwoPhotoStoredName: playerTwoPhoto.filename,
      playerTwoPhotoOriginalName: playerTwoPhoto.originalname,
      playerTwoPhotoMimeType: playerTwoPhoto.mimetype,
      playerTwoPhotoSizeBytes: playerTwoPhoto.size,
      playerThreeName: normalizeOptional(dto.playerThreeName),
      playerThreeDni: normalizeOptional(dto.playerThreeDni),
      playerThreeBirthDate: normalizeOptional(dto.playerThreeBirthDate),
      playerThreePhone: normalizeOptional(dto.playerThreePhone),
      playerThreeInstagram: normalizeOptional(dto.playerThreeInstagram),
      playerThreeShirtSize: dto.playerThreeShirtSize ?? null,
      playerThreeHasCommercialAgreement: dto.playerThreeHasCommercialAgreement ?? false,
      playerThreeCommercialAgreementDetails: normalizeOptional(dto.playerThreeCommercialAgreementDetails),
      playerThreePhotoStoredName: playerThreePhoto?.filename ?? null,
      playerThreePhotoOriginalName: playerThreePhoto?.originalname ?? null,
      playerThreePhotoMimeType: playerThreePhoto?.mimetype ?? null,
      playerThreePhotoSizeBytes: playerThreePhoto?.size ?? null,
      paymentProofStoredName: paymentProof?.filename ?? null,
      paymentProofOriginalName: paymentProof?.originalname ?? null,
      paymentProofMimeType: paymentProof?.mimetype ?? null,
      paymentProofSizeBytes: paymentProof?.size ?? null,
      status: RegistrationStatus.RECEIVED,
      adminNotes: null,
    });

    const saved = await this.registrationsRepository.save(registration);
    await this.playersService.syncRegistrationPlayers(saved);
    grant.status = RegistrationAccessGrantStatus.USED;
    grant.consumedAt = new Date();
    await this.accessGrantsRepository.save(grant);

    return {
      id: saved.id,
      status: saved.status,
      message: 'Inscripcion recibida',
    };
  }

  async list(query: QueryRegistrationsDto) {
    const qb = this.registrationsRepository.createQueryBuilder('registration');

    if (query.category) {
      qb.andWhere('registration.category = :category', { category: query.category });
    }

    if (query.status) {
      qb.andWhere('registration.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((inner) => {
          inner
            .where('LOWER(registration.playerOneName) LIKE :term', { term })
            .orWhere('LOWER(registration.playerTwoName) LIKE :term', { term })
            .orWhere('LOWER(registration.clubName) LIKE :term', { term })
            .orWhere('LOWER(registration.localityName) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(registration.playerThreeName, \'\')) LIKE :term', { term });
        }),
      );
    }

    qb.orderBy('registration.createdAt', 'DESC');

    return qb.getMany();
  }

  async getById(id: number) {
    const registration = await this.registrationsRepository.findOne({
      where: { id },
      relations: {
        accessGrant: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    return registration;
  }

  async updateStatus(id: number, dto: UpdateRegistrationStatusDto) {
    const registration = await this.getById(id);
    registration.status = dto.status;
    registration.adminNotes =
      dto.adminNotes === undefined ? registration.adminNotes : dto.adminNotes.trim() || null;
    return this.registrationsRepository.save(registration);
  }

  async remove(id: number) {
    const registration = await this.getById(id);

    try {
      await this.registrationsRepository.manager.transaction(async (manager) => {
        await manager.remove(PairRegistration, registration);
        await manager.update(
          RegistrationAccessGrant,
          { id: registration.accessGrantId },
          {
            status: RegistrationAccessGrantStatus.ACTIVE,
            consumedAt: null,
          },
        );
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(
          'No se puede eliminar un registro asignado a una zona o a partidos',
        );
      }
      throw error;
    }

    [registration.paymentProofStoredName, registration.playerOnePhotoStoredName, registration.playerTwoPhotoStoredName, registration.playerThreePhotoStoredName].forEach((storedName) => {
      if (storedName) this.cleanupStoredPaymentProof(storedName);
    });

    return { success: true };
  }

  async getPaymentProof(id: number) {
    const registration = await this.getById(id);
    if (
      !registration.paymentProofStoredName ||
      !registration.paymentProofOriginalName ||
      !registration.paymentProofMimeType
    ) {
      throw new NotFoundException('Esta inscripcion no tiene comprobante porque fue bonificada');
    }
    const storedName = registration.paymentProofStoredName;
    const originalName = registration.paymentProofOriginalName;
    const contentType = registration.paymentProofMimeType;
    const filePath = join(ensurePaymentProofDir(), storedName);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Payment proof file not found');
    }

    return {
      stream: new StreamableFile(createReadStream(filePath)),
      filename: originalName,
      contentType,
    };
  }

  private async findAccessGrantByToken(token: string) {
    const normalizedToken = token.trim().toUpperCase();
    const grant = await this.accessGrantsRepository.findOne({
      where: { token: normalizedToken },
    });

    if (!grant) {
      throw new NotFoundException('Token invalido');
    }

    return grant;
  }

  private async generateUniqueToken() {
    while (true) {
      const token = buildToken();
      const existing = await this.accessGrantsRepository.findOne({ where: { token } });

      if (!existing) {
        return token;
      }
    }
  }

  private cleanupUploadedFiles(files: RegistrationFiles) {
    Object.values(files).forEach((file) => {
      if (!file?.path) return;
      try { unlinkSync(file.path); } catch { return; }
    });
  }

  private cleanupStoredPaymentProof(storedName: string) {
    try {
      unlinkSync(join(ensurePaymentProofDir(), storedName));
    } catch {
      return;
    }
  }
}

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let compact = '';

  for (let index = 0; index < 8; index += 1) {
    compact += alphabet[bytes[index] % alphabet.length];
  }

  return `COPA-${compact}`;
}

function isForeignKeyViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
}
