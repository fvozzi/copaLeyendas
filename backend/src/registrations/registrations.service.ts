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

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(PairRegistration)
    private readonly registrationsRepository: Repository<PairRegistration>,
    @InjectRepository(RegistrationAccessGrant)
    private readonly accessGrantsRepository: Repository<RegistrationAccessGrant>,
  ) {}

  async createAccessGrant(dto: CreateAccessGrantDto) {
    const token = await this.generateUniqueToken();
    const localityName = dto.localityName.trim();
    const grant = this.accessGrantsRepository.create({
      token,
      category: dto.category,
      localityName,
      provinceName: dto.provinceName.trim(),
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

  async createPublic(dto: CreatePublicRegistrationDto, paymentProof?: Express.Multer.File) {
    ensurePaymentProofDir();
    const grant = await this.findAccessGrantByToken(dto.accessToken);

    if (grant.status !== RegistrationAccessGrantStatus.ACTIVE) {
      this.cleanupUploadedFile(paymentProof);
      throw new BadRequestException('Token no disponible para nuevas inscripciones');
    }

    const existingCount = await this.registrationsRepository.count({
      where: { accessGrantId: grant.id },
    });

    if (existingCount > 0) {
      this.cleanupUploadedFile(paymentProof);
      throw new BadRequestException('Este token ya fue utilizado');
    }

    if (!dto.tournamentAvailabilityConfirmed) {
      this.cleanupUploadedFile(paymentProof);
      throw new BadRequestException('Debe confirmar disponibilidad para las fechas del torneo');
    }

    if (dto.heardAboutSource === HeardAboutSource.OTHER && !dto.heardAboutOtherText?.trim()) {
      this.cleanupUploadedFile(paymentProof);
      throw new BadRequestException('Debe indicar como se entero del evento');
    }

    if (!grant.feeWaived && !paymentProof) {
      throw new BadRequestException('Debe adjuntar el comprobante de pago');
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
      playerTwoName: dto.playerTwoName.trim(),
      playerTwoDni: dto.playerTwoDni.trim(),
      playerTwoBirthDate: dto.playerTwoBirthDate,
      playerTwoPhone: dto.playerTwoPhone.trim(),
      playerTwoInstagram: normalizeOptional(dto.playerTwoInstagram),
      playerTwoShirtSize: dto.playerTwoShirtSize,
      playerThreeName: normalizeOptional(dto.playerThreeName),
      playerThreeDni: normalizeOptional(dto.playerThreeDni),
      playerThreeBirthDate: normalizeOptional(dto.playerThreeBirthDate),
      playerThreePhone: normalizeOptional(dto.playerThreePhone),
      playerThreeInstagram: normalizeOptional(dto.playerThreeInstagram),
      playerThreeShirtSize: dto.playerThreeShirtSize ?? null,
      paymentProofStoredName: paymentProof?.filename ?? null,
      paymentProofOriginalName: paymentProof?.originalname ?? null,
      paymentProofMimeType: paymentProof?.mimetype ?? null,
      paymentProofSizeBytes: paymentProof?.size ?? null,
      status: RegistrationStatus.RECEIVED,
      adminNotes: null,
    });

    const saved = await this.registrationsRepository.save(registration);
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

  private cleanupUploadedFile(paymentProof?: Express.Multer.File) {
    if (!paymentProof?.path) {
      return;
    }

    try {
      unlinkSync(paymentProof.path);
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
