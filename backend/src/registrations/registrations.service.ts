import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, Repository } from 'typeorm';
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
import { RegistrationPayment } from './registration-payment.entity';
import { RegistrationAccessGrant } from './registration-access-grant.entity';
import { Locality } from '../localities/locality.entity';
import { PlayersService } from '../players/players.service';
import { GoogleDrivePhotoStorageService } from './google-drive-photo-storage.service';
import { Tournament } from '../tournaments/tournament.entity';
import { TournamentStatus } from '../tournaments/tournament.enums';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WhatsAppDelivery } from '../whatsapp/whatsapp-delivery.entity';
import { Player } from '../players/player.entity';
import { ZoneEntry } from '../tournaments/zone-entry.entity';
import { TournamentMatch } from '../tournaments/tournament-match.entity';
import { MatchStatus } from '../tournaments/tournament.enums';
import { removeMatchResultPhoto } from '../tournaments/match-result-photo-storage';

interface RegistrationFiles {
  paymentProof?: Express.Multer.File;
  playerOnePhoto?: Express.Multer.File;
  playerTwoPhoto?: Express.Multer.File;
  playerThreePhoto?: Express.Multer.File;
}

export interface CompleteTeamRemovalImpact {
  teamName: string;
  accessGrants: number;
  registrations: number;
  players: number;
  retainedPlayers: number;
  payments: number;
  cashIncomeAmount: number;
  zoneAssignments: number;
  affectedMatches: number;
  playedMatches: number;
}

interface CompleteTeamRemovalData {
  impact: CompleteTeamRemovalImpact;
  localityId: number;
  grantIds: number[];
  registrations: PairRegistration[];
  playersToDelete: Player[];
  zoneEntries: ZoneEntry[];
  matches: TournamentMatch[];
  affectedMatchIds: Set<number>;
  affectedZoneIds: Set<number>;
  whatsappMessageIds: string[];
}

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    @InjectRepository(PairRegistration)
    private readonly registrationsRepository: Repository<PairRegistration>,
    @InjectRepository(RegistrationAccessGrant)
    private readonly accessGrantsRepository: Repository<RegistrationAccessGrant>,
    @InjectRepository(Locality)
    private readonly localitiesRepository: Repository<Locality>,
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    private readonly playersService: PlayersService,
    private readonly googleDrivePhotos: GoogleDrivePhotoStorageService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async createAccessGrant(dto: CreateAccessGrantDto) {
    const token = await this.generateUniqueToken();
    const locality = await this.localitiesRepository.findOne({ where: { id: dto.localityId }, relations: { category: true } });
    if (!locality) throw new NotFoundException('Localidad no encontrada');
    if (!locality.active) {
      throw new BadRequestException('La localidad debe tener una categoria activa para habilitarse');
    }
    const category = locality.category;
    if (!category) throw new BadRequestException('Debe seleccionar una categoria');
    if (!category.active) throw new BadRequestException('La categoria seleccionada no esta activa');
    const grant = this.accessGrantsRepository.create({
      token,
      localityId: locality.id,
      locality,
      categoryId: category.id,
      category,
      contactName: normalizeOptional(dto.contactName),
      contactEmail: normalizeOptional(dto.contactEmail),
      contactPhone: normalizeOptional(dto.contactPhone),
      notes: normalizeOptional(dto.notes),
      feeWaived: dto.feeWaived ?? false,
      paymentDeferredUntilConfirmed: dto.paymentDeferredUntilConfirmed ?? false,
      status: RegistrationAccessGrantStatus.ACTIVE,
      consumedAt: null,
      whatsappSentAt: null,
    });

    return this.accessGrantsRepository.save(grant);
  }

  async listAccessGrants(query: QueryAccessGrantsDto) {
    const qb = this.accessGrantsRepository.createQueryBuilder('grant').leftJoinAndSelect('grant.category', 'category')
      .leftJoinAndSelect('grant.locality', 'locality')
      .leftJoin('grant.registrations', 'registration')
      .addSelect(['registration.id', 'registration.status', 'registration.feeWaived', 'registration.paymentDeferredUntilConfirmed', 'registration.paymentProofStoredName'])
      .leftJoinAndMapOne('grant.whatsappDelivery', WhatsAppDelivery, 'delivery', 'delivery.messageId = grant.whatsappMessageId');

    if (query.categoryId) {
      qb.andWhere('grant.categoryId = :categoryId', { categoryId: query.categoryId });
    }

    if (query.status) {
      qb.andWhere('grant.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((inner) => {
          inner
            .where('LOWER(locality.name) LIKE :term', { term })
            .orWhere('LOWER(locality.provinceName) LIKE :term', { term })
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

    if (dto.status === RegistrationAccessGrantStatus.USED) {
      throw new BadRequestException('El token se marca usado al recibir la inscripción');
    }

    if (grant.status === RegistrationAccessGrantStatus.USED && dto.status !== RegistrationAccessGrantStatus.ACTIVE) {
      throw new BadRequestException('Un token usado solo puede rehabilitarse para rectificar');
    }
    const updated = await this.accessGrantsRepository.update(
      { id, status: grant.status }, { status: dto.status },
    );
    if (!updated.affected) throw new BadRequestException('El token cambió de estado. Actualizá la página');
    return { ...grant, status: dto.status };
  }

  async sendAccessGrantTokenByWhatsApp(id: number, siteUrl: string) {
    const grant = await this.accessGrantsRepository.findOne({ where: { id }, relations: { category: true, locality: true } });

    if (!grant) {
      throw new NotFoundException('Equipo habilitado no encontrado');
    }

    if (!grant.contactPhone) {
      throw new BadRequestException('El token no tiene un telefono de contacto');
    }

    if (grant.status !== RegistrationAccessGrantStatus.ACTIVE) {
      throw new BadRequestException('Solo se pueden enviar tokens activos');
    }

    const contactName = grant.contactName?.trim() || grant.locality.name;
    const result = await this.whatsAppService.sendRegistrationToken(
      grant.contactPhone,
      contactName,
      grant.token,
      grant.locality.name,
      siteUrl,
      grant.category.name,
    );

    const messageId = result.messages?.[0]?.id;
    if (!messageId) throw new BadGatewayException('WhatsApp no confirmo la aceptacion del mensaje');
    const whatsappSentAt = new Date();
    // Update only the send timestamp: the token may have been consumed during the request to Meta.
    await this.accessGrantsRepository.update(id, { whatsappSentAt, whatsappMessageId: messageId });

    return {
      success: true,
      messageId,
      whatsappSentAt,
      contactName,
      contactPhone: grant.contactPhone,
    };
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
      throw new BadRequestException('Este equipo tiene una inscripción asociada. Usá “Dar de baja” para revisar el impacto y eliminar todo.');
    }

    await this.accessGrantsRepository.remove(grant);
    return { success: true };
  }

  async getCompleteTeamRemovalImpact(id: number) {
    const data = await this.loadCompleteTeamRemovalData(
      this.registrationsRepository.manager,
      id,
    );
    return data.impact;
  }

  async removeCompleteTeam(id: number) {
    const registrationFiles = new Set<string>();
    const resultPhotos = new Set<string>();
    const impact = await this.registrationsRepository.manager.transaction(async (manager) => {
      const data = await this.loadCompleteTeamRemovalData(manager, id, true);
      const registrationIds = data.registrations.map((registration) => registration.id);

      for (const registration of data.registrations) {
        [
          registration.paymentProofStoredName,
          ...(registration.payments ?? []).map((payment) => payment.storedName),
          registration.playerOnePhotoStoredName,
          registration.playerTwoPhotoStoredName,
          registration.playerThreePhotoStoredName,
        ].forEach((storedName) => { if (storedName) registrationFiles.add(storedName); });
      }

      const removedRegistrationIds = new Set(registrationIds);
      for (const match of data.matches.filter((item) => data.affectedMatchIds.has(item.id))) {
        if (match.resultPhotoStoredName) resultPhotos.add(match.resultPhotoStoredName);
        if (
          (match.homeRegistrationId && removedRegistrationIds.has(match.homeRegistrationId))
          || (match.homeSourceMatchId && data.affectedMatchIds.has(match.homeSourceMatchId))
          || (match.homeQualifierZoneId && data.affectedZoneIds.has(match.homeQualifierZoneId))
        ) match.homeRegistrationId = null;
        if (
          (match.awayRegistrationId && removedRegistrationIds.has(match.awayRegistrationId))
          || (match.awaySourceMatchId && data.affectedMatchIds.has(match.awaySourceMatchId))
          || (match.awayQualifierZoneId && data.affectedZoneIds.has(match.awayQualifierZoneId))
        ) match.awayRegistrationId = null;
        match.homeScore = null;
        match.awayScore = null;
        match.winnerRegistrationId = null;
        match.resultPhotoStoredName = null;
        match.resultPhotoOriginalName = null;
        match.resultPhotoMimeType = null;
        match.resultPhotoSize = null;
        match.resultSubmittedById = null;
        match.resultSubmittedAt = null;
        match.status = match.homeRegistrationId && match.awayRegistrationId
          ? MatchStatus.READY
          : MatchStatus.PENDING;
      }

      const affectedMatches = data.matches.filter((item) => data.affectedMatchIds.has(item.id));
      if (affectedMatches.length) await manager.save(TournamentMatch, affectedMatches);
      if (data.zoneEntries.length) await manager.delete(ZoneEntry, { id: In(data.zoneEntries.map((entry) => entry.id)) });
      if (registrationIds.length) await manager.delete(PairRegistration, { id: In(registrationIds) });
      if (data.whatsappMessageIds.length) await manager.delete(WhatsAppDelivery, { messageId: In(data.whatsappMessageIds) });
      if (data.grantIds.length) await manager.delete(RegistrationAccessGrant, { id: In(data.grantIds) });
      if (data.playersToDelete.length) await manager.delete(Player, { id: In(data.playersToDelete.map((player) => player.id)) });
      await manager.delete(Locality, { id: data.localityId });
      return data.impact;
    });

    registrationFiles.forEach((storedName) => this.cleanupStoredPaymentProof(storedName));
    const photoResults = await Promise.allSettled([...resultPhotos].map((storedName) => removeMatchResultPhoto(storedName)));
    if (photoResults.some((result) => result.status === 'rejected')) {
      this.logger.warn(`El equipo ${impact.teamName} fue eliminado, pero no se pudieron borrar todas las fotos de resultados.`);
    }
    return { success: true, ...impact };
  }

  async getPublicAccessGrant(token: string) {
    const grant = await this.findAccessGrantByToken(token);
    // Only an explicitly reopened token may expose the previously submitted form.
    const registration = grant.status === RegistrationAccessGrantStatus.ACTIVE
      ? await this.registrationsRepository.findOne({ where: { accessGrantId: grant.id }, relations: { payments: true } })
      : null;

    return {
      id: grant.id,
      token: grant.token,
      categoryId: grant.categoryId,
      category: grant.category,
      localityId: grant.localityId,
      locality: grant.locality,
      contactName: grant.contactName,
      contactEmail: grant.contactEmail,
      contactPhone: grant.contactPhone,
      feeWaived: registration?.feeWaived ?? grant.feeWaived,
      paymentDeferredUntilConfirmed: registration?.paymentDeferredUntilConfirmed ?? grant.paymentDeferredUntilConfirmed,
      status: grant.status,
      enabled: grant.status === RegistrationAccessGrantStatus.ACTIVE,
      registration: registration ? publicRegistrationDraft(registration) : null,
    };
  }

  async createPublic(dto: CreatePublicRegistrationDto, files: RegistrationFiles = {}) {
    const playerOneAgreementDetails = normalizeOptional(dto.playerOneCommercialAgreementDetails);
    const playerTwoAgreementDetails = normalizeOptional(dto.playerTwoCommercialAgreementDetails);
    const playerThreeAgreementDetails = normalizeOptional(dto.playerThreeCommercialAgreementDetails);
    ensurePaymentProofDir();
    const { paymentProof, playerOnePhoto, playerTwoPhoto, playerThreePhoto } = files;
    const replacedFiles: string[] = [];
    let drivePhotos: { playerOne?: string | null; playerTwo?: string | null; playerThree?: string | null } = {};
    let correcting = false;
    let saved: PairRegistration;
    try {
      saved = await this.registrationsRepository.manager.transaction(async (manager) => {
        const grant = await manager.findOne(RegistrationAccessGrant, {
          where: { token: dto.accessToken.trim().toUpperCase() },
          lock: { mode: 'pessimistic_write' },
        });
        if (!grant || grant.status !== RegistrationAccessGrantStatus.ACTIVE) {
          throw new BadRequestException('Token no disponible para enviar la inscripcion');
        }
        // Lock only the token row. PostgreSQL cannot apply FOR UPDATE to the
        // nullable side of the LEFT JOIN generated by TypeORM for relations.
        const locality = await manager.findOneBy(Locality, { id: grant.localityId });
        if (!locality) throw new BadRequestException('El equipo asociado al token ya no esta disponible');
        const existing = await manager.findOne(PairRegistration, {
          where: { accessGrantId: grant.id }, lock: { mode: 'pessimistic_write' },
        });
        correcting = Boolean(existing);
        const payments = existing ? await manager.find(RegistrationPayment, { where: { registrationId: existing.id } }) : [];
        const rosterSize = dto.playerThreeName?.trim() ? 3 : 2;
        const previousSize = existing?.playerThreeName?.trim() ? 3 : 2;
        const coveredRoster = Math.max(previousSize, ...payments.filter((payment) => payment.amount > 0).map((payment) => payment.rosterSize));
        const feeWaived = existing?.feeWaived ?? grant.feeWaived;
        const deferred = existing?.paymentDeferredUntilConfirmed ?? grant.paymentDeferredUntilConfirmed;
        const additionalPlayers = existing && !feeWaived ? Math.max(0, rosterSize - coveredRoster) : 0;
        if (additionalPlayers && !paymentProof) throw new BadRequestException('Debe adjuntar un nuevo comprobante por la jugadora suplente agregada');
        if (!dto.tournamentAvailabilityConfirmed) {
          throw new BadRequestException('Debe confirmar disponibilidad para las fechas del torneo');
        }

        if (dto.heardAboutSource === HeardAboutSource.OTHER && !dto.heardAboutOtherText?.trim()) {
          throw new BadRequestException('Debe indicar como se entero del evento');
        }

        if (!feeWaived && !deferred && !paymentProof && !existing?.paymentProofStoredName) {
          throw new BadRequestException('Debe adjuntar el comprobante de pago');
        }

        const submittedDnis = [dto.playerOneDni.trim(), dto.playerTwoDni.trim(), dto.playerThreeName?.trim() ? dto.playerThreeDni?.trim() : null].filter(Boolean);
        if (new Set(submittedDnis).size !== submittedDnis.length) throw new BadRequestException('Las jugadoras deben tener DNI diferentes');
        if (playerThreePhoto && !dto.playerThreeName?.trim()) throw new BadRequestException('Debe completar los datos de la suplente antes de adjuntar su foto');
        drivePhotos = await this.uploadPlayerPhotos(files, dto);
        const activeTournament = await this.tournamentsRepository.findOne({ where: { status: TournamentStatus.ACTIVE }, order: { startsAt: 'ASC', id: 'ASC' } });
        const registration = this.registrationsRepository.create({
          ...existing,
          accessGrantId: grant.id,
          categoryId: grant.categoryId,
          localityId: grant.localityId,
          locality,
          heardAboutSource: dto.heardAboutSource,
          heardAboutOtherText: normalizeOptional(dto.heardAboutOtherText),
          tournamentAvailabilityConfirmed: dto.tournamentAvailabilityConfirmed,
          representingText: dto.representingText.trim(),
          contactEmail: normalizeOptional(dto.contactEmail),
          feeWaived: existing?.feeWaived ?? grant.feeWaived,
          feePerPlayer: existing?.feePerPlayer ?? activeTournament?.feePerPlayer ?? 15000,
          paymentDeferredUntilConfirmed: existing?.paymentDeferredUntilConfirmed ?? grant.paymentDeferredUntilConfirmed,
          playerOneName: dto.playerOneName.trim(),
          playerOneDni: dto.playerOneDni.trim(),
          playerOneBirthDate: dto.playerOneBirthDate,
          playerOnePhone: dto.playerOnePhone.trim(),
          playerOneInstagram: normalizeOptional(dto.playerOneInstagram),
          playerOneShirtSize: dto.playerOneShirtSize,
          playerOneHasCommercialAgreement: Boolean(dto.playerOneHasCommercialAgreement && playerOneAgreementDetails),
          playerOneCommercialAgreementDetails: dto.playerOneHasCommercialAgreement ? playerOneAgreementDetails : null,
          playerOnePhotoStoredName: drivePhotos.playerOne ?? playerOnePhoto?.filename ?? existing?.playerOnePhotoStoredName ?? null,
          playerOnePhotoOriginalName: playerOnePhoto?.originalname ?? existing?.playerOnePhotoOriginalName ?? null,
          playerOnePhotoMimeType: playerOnePhoto?.mimetype ?? existing?.playerOnePhotoMimeType ?? null,
          playerOnePhotoSizeBytes: playerOnePhoto?.size ?? existing?.playerOnePhotoSizeBytes ?? null,
          playerTwoName: dto.playerTwoName.trim(),
          playerTwoDni: dto.playerTwoDni.trim(),
          playerTwoBirthDate: dto.playerTwoBirthDate,
          playerTwoPhone: dto.playerTwoPhone.trim(),
          playerTwoInstagram: normalizeOptional(dto.playerTwoInstagram),
          playerTwoShirtSize: dto.playerTwoShirtSize,
          playerTwoHasCommercialAgreement: Boolean(dto.playerTwoHasCommercialAgreement && playerTwoAgreementDetails),
          playerTwoCommercialAgreementDetails: dto.playerTwoHasCommercialAgreement ? playerTwoAgreementDetails : null,
          playerTwoPhotoStoredName: drivePhotos.playerTwo ?? playerTwoPhoto?.filename ?? existing?.playerTwoPhotoStoredName ?? null,
          playerTwoPhotoOriginalName: playerTwoPhoto?.originalname ?? existing?.playerTwoPhotoOriginalName ?? null,
          playerTwoPhotoMimeType: playerTwoPhoto?.mimetype ?? existing?.playerTwoPhotoMimeType ?? null,
          playerTwoPhotoSizeBytes: playerTwoPhoto?.size ?? existing?.playerTwoPhotoSizeBytes ?? null,
          playerThreeName: normalizeOptional(dto.playerThreeName),
          playerThreeDni: normalizeOptional(dto.playerThreeDni),
          playerThreeBirthDate: normalizeOptional(dto.playerThreeBirthDate),
          playerThreePhone: normalizeOptional(dto.playerThreePhone),
          playerThreeInstagram: normalizeOptional(dto.playerThreeInstagram),
          playerThreeShirtSize: dto.playerThreeName?.trim() ? dto.playerThreeShirtSize ?? null : null,
          playerThreeHasCommercialAgreement: Boolean(dto.playerThreeHasCommercialAgreement && playerThreeAgreementDetails),
          playerThreeCommercialAgreementDetails: dto.playerThreeHasCommercialAgreement ? playerThreeAgreementDetails : null,
          playerThreePhotoStoredName: drivePhotos.playerThree ?? playerThreePhoto?.filename ?? existing?.playerThreePhotoStoredName ?? null,
          playerThreePhotoOriginalName: playerThreePhoto?.originalname ?? existing?.playerThreePhotoOriginalName ?? null,
          playerThreePhotoMimeType: playerThreePhoto?.mimetype ?? existing?.playerThreePhotoMimeType ?? null,
          playerThreePhotoSizeBytes: playerThreePhoto?.size ?? existing?.playerThreePhotoSizeBytes ?? null,
          paymentProofStoredName: existing?.paymentProofStoredName ?? paymentProof?.filename ?? null,
          paymentProofOriginalName: existing?.paymentProofOriginalName ?? paymentProof?.originalname ?? null,
          paymentProofMimeType: existing?.paymentProofMimeType ?? paymentProof?.mimetype ?? null,
          paymentProofSizeBytes: existing?.paymentProofSizeBytes ?? paymentProof?.size ?? null,
          status: existing?.status ?? (grant.paymentDeferredUntilConfirmed ? RegistrationStatus.WAITLIST : RegistrationStatus.RECEIVED),
          adminNotes: existing?.adminNotes ?? null,
        });

        if (!registration.playerThreeName) {
          registration.playerThreeDni = null;
          registration.playerThreeBirthDate = null;
          registration.playerThreePhone = null;
          registration.playerThreeInstagram = null;
          registration.playerThreeHasCommercialAgreement = false;
          registration.playerThreeCommercialAgreementDetails = null;
          registration.playerThreePhotoStoredName = null;
          registration.playerThreePhotoOriginalName = null;
          registration.playerThreePhotoMimeType = null;
          registration.playerThreePhotoSizeBytes = null;
        }
        for (const field of ['paymentProofStoredName', 'playerOnePhotoStoredName', 'playerTwoPhotoStoredName', 'playerThreePhotoStoredName'] as const) {
          if (existing?.[field] && existing[field] !== registration[field]) replacedFiles.push(existing[field]!);
        }
        await manager.update(RegistrationAccessGrant, { id: grant.id },
          { status: RegistrationAccessGrantStatus.USED, consumedAt: new Date() });
        const result = await manager.save(PairRegistration, registration);
        if (paymentProof) {
          const players = feeWaived ? 0 : additionalPlayers || (!existing?.paymentProofStoredName ? rosterSize : 0);
          await manager.save(RegistrationPayment, manager.create(RegistrationPayment, {
            registrationId: result.id, kind: additionalPlayers ? 'ADDITIONAL' : existing?.paymentProofStoredName ? 'REPLACEMENT' : 'INITIAL',
            players, rosterSize, amount: players * result.feePerPlayer,
            storedName: paymentProof.filename, originalName: paymentProof.originalname,
            mimeType: paymentProof.mimetype, sizeBytes: paymentProof.size,
          }));
        }
        if (existing) await this.playersService.syncRegistrationPlayers(result, { manager, previous: existing });
        return result;
      });
    } catch (error) {
      this.cleanupUploadedFiles(files);
      for (const storedName of Object.values(drivePhotos)) if (storedName) this.cleanupStoredPaymentProof(storedName);
      throw error;
    }
    replacedFiles.forEach((storedName) => this.cleanupStoredPaymentProof(storedName));
    try {
      if (!correcting) await this.playersService.syncRegistrationPlayers(saved);
    } catch {
      // The players list retries this synchronization from the saved registrations.
      this.logger.warn(`Inscripcion ${saved.id} recibida; sincronizacion de jugadoras pendiente`);
    }

    return {
      id: saved.id,
      status: saved.status,
      message: correcting ? 'Inscripci\u00f3n actualizada con \u00e9xito.' : 'Inscripci\u00f3n realizada con \u00e9xito.',
    };
  }

  async list(query: QueryRegistrationsDto) {
    const qb = this.registrationsRepository.createQueryBuilder('registration').leftJoinAndSelect('registration.category', 'category').leftJoinAndSelect('registration.locality', 'locality').leftJoinAndSelect('registration.payments', 'payments');

    if (query.categoryId) {
      qb.andWhere('registration.categoryId = :categoryId', { categoryId: query.categoryId });
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
            .orWhere('LOWER(locality.name) LIKE :term', { term })
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
        category: true,
        locality: true,
        payments: true,
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    return registration;
  }

  async updateStatus(id: number, dto: UpdateRegistrationStatusDto) {
    const current = await this.getById(id);
    await this.registrationsRepository.manager.transaction(async (manager) => {
      // Same lock order as public corrections: grant, then registration.
      const grant = await manager.findOne(RegistrationAccessGrant, {
        where: { id: current.accessGrantId }, lock: { mode: 'pessimistic_write' },
      });
      const registration = await manager.findOne(PairRegistration, {
        where: { id }, lock: { mode: 'pessimistic_write' },
      });
      if (!grant || !registration) throw new NotFoundException('Registration not found');
      await manager.update(PairRegistration, { id }, {
        status: dto.status,
        feeWaived: dto.feeWaived ?? registration.feeWaived,
        adminNotes: dto.adminNotes === undefined ? registration.adminNotes : dto.adminNotes.trim() || null,
      });
      if (dto.feeWaived !== undefined && dto.feeWaived !== grant.feeWaived) {
        await manager.update(RegistrationAccessGrant, { id: grant.id }, { feeWaived: dto.feeWaived });
      }
      if (dto.status === RegistrationStatus.CONFIRMED) {
        await manager.update(RegistrationAccessGrant, { id: grant.id }, {
          status: RegistrationAccessGrantStatus.USED,
          consumedAt: grant.consumedAt ?? registration.createdAt,
        });
      }
    });
    return this.getById(id);
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
          'Este registro tiene zonas o partidos asignados. Usá “Dar de baja equipo” para revisar el impacto y eliminar todo.',
        );
      }
      throw error;
    }

    new Set([registration.paymentProofStoredName, ...(registration.payments ?? []).map((payment) => payment.storedName), registration.playerOnePhotoStoredName, registration.playerTwoPhotoStoredName, registration.playerThreePhotoStoredName]).forEach((storedName) => {
      if (storedName) this.cleanupStoredPaymentProof(storedName);
    });

    return { success: true };
  }

  async getPaymentProof(id: number, paymentId?: number) {
    const registration = await this.getById(id);
    if (paymentId !== undefined) {
      const payment = registration.payments.find((item) => item.id === paymentId);
      if (!payment) throw new NotFoundException('Comprobante no encontrado en esta inscripción');
      const path = join(ensurePaymentProofDir(), payment.storedName);
      if (!existsSync(path)) throw new NotFoundException('Archivo de comprobante no encontrado');
      return { stream: new StreamableFile(createReadStream(path)), filename: payment.originalName, contentType: payment.mimeType };
    }
    if (
      !registration.paymentProofStoredName ||
      !registration.paymentProofOriginalName ||
      !registration.paymentProofMimeType
    ) {
      if (registration.paymentDeferredUntilConfirmed) {
        throw new NotFoundException('Esta inscripcion esta en lista de espera. El comprobante se solicitara al confirmarla.');
      }
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
      relations: { category: true, locality: true },
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
    if (storedName.startsWith('drive:')) { void this.googleDrivePhotos.remove(storedName); return; }
    try {
      unlinkSync(join(ensurePaymentProofDir(), storedName));
    } catch {
      return;
    }
  }

  private async loadCompleteTeamRemovalData(
    manager: EntityManager,
    accessGrantId: number,
    lock = false,
  ): Promise<CompleteTeamRemovalData> {
    const grant = await manager.findOne(RegistrationAccessGrant, {
      where: { id: accessGrantId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!grant) throw new NotFoundException('Equipo habilitado no encontrado');
    const locality = await manager.findOneBy(Locality, { id: grant.localityId });
    if (!locality) throw new NotFoundException('Equipo no encontrado');

    const grants = await manager.find(RegistrationAccessGrant, { where: { localityId: locality.id } });
    const registrations = await manager.find(PairRegistration, {
      where: { localityId: locality.id },
      relations: { payments: true },
    });
    const registrationIds = registrations.map((registration) => registration.id);
    const players = await manager.find(Player, { where: { localityId: locality.id } });
    const allRegistrations = await manager.find(PairRegistration);
    const otherRegistrations = allRegistrations.filter((registration) => !registrationIds.includes(registration.id));
    const usedElsewhere = (dni: string) => otherRegistrations.some((registration) => [
      registration.playerOneDni,
      registration.playerTwoDni,
      registration.playerThreeDni,
    ].some((value) => value?.trim() === dni.trim()));
    const playersToDelete = players.filter((player) => !usedElsewhere(player.dni));
    const zoneEntries = registrationIds.length
      ? await manager.find(ZoneEntry, { where: { registrationId: In(registrationIds) } })
      : [];
    const affectedZoneIds = new Set(zoneEntries.map((entry) => entry.zoneId));
    const matches = await manager.find(TournamentMatch);
    const affectedMatchIds = collectAffectedMatchIds(
      matches,
      new Set(registrationIds),
      affectedZoneIds,
    );
    const affectedMatches = matches.filter((match) => affectedMatchIds.has(match.id));
    const payments = registrations.flatMap((registration) => registration.payments ?? []);
    return {
      impact: {
        teamName: locality.name,
        accessGrants: grants.length,
        registrations: registrations.length,
        players: playersToDelete.length,
        retainedPlayers: players.length - playersToDelete.length,
        payments: payments.length,
        cashIncomeAmount: registrations.reduce((total, registration) => total + (registration.feeWaived
          ? 0
          : (registration.payments ?? []).reduce((subtotal, payment) => subtotal + Math.max(0, payment.amount), 0)), 0),
        zoneAssignments: zoneEntries.length,
        affectedMatches: affectedMatches.length,
        playedMatches: affectedMatches.filter((match) => match.status === MatchStatus.PLAYED).length,
      },
      localityId: locality.id,
      grantIds: grants.map((item) => item.id),
      registrations,
      playersToDelete,
      zoneEntries,
      matches,
      affectedMatchIds,
      affectedZoneIds,
      whatsappMessageIds: grants.flatMap((item) => item.whatsappMessageId ? [item.whatsappMessageId] : []),
    };
  }

  private async uploadPlayerPhotos(files: RegistrationFiles, dto: CreatePublicRegistrationDto) {
    if (!this.googleDrivePhotos.enabled()) return {};
    try {
      const tournament = await this.tournamentsRepository.findOne({ where: { status: TournamentStatus.ACTIVE }, order: { startsAt: 'ASC', id: 'ASC' } });
      if (!tournament) throw new BadRequestException('No hay un torneo activo para asignar las fotos en Google Drive');
      const folderName = `${tournament.name}${tournament.startsAt ? ` - ${tournament.startsAt}` : ''}`;
      const tournamentFolderId = await this.googleDrivePhotos.ensureTournamentFolder(folderName, tournament.driveFolderId);
      tournament.driveFolderId = tournamentFolderId;
      await this.tournamentsRepository.save(tournament);
      const [playerOne, playerTwo, playerThree] = await Promise.all([
        files.playerOnePhoto ? this.googleDrivePhotos.upload(files.playerOnePhoto, dto.playerOneName, tournamentFolderId) : null,
        files.playerTwoPhoto ? this.googleDrivePhotos.upload(files.playerTwoPhoto, dto.playerTwoName, tournamentFolderId) : null,
        files.playerThreePhoto && dto.playerThreeName ? this.googleDrivePhotos.upload(files.playerThreePhoto, dto.playerThreeName, tournamentFolderId) : null,
      ]);
      [files.playerOnePhoto, files.playerTwoPhoto, files.playerThreePhoto].forEach((file) => { if (file?.path) { try { unlinkSync(file.path); } catch { return; } } });
      return { playerOne, playerTwo, playerThree };
    } catch (error) {
      this.cleanupUploadedFiles(files);
      throw new BadRequestException(error instanceof Error ? `No se pudieron guardar las fotos: ${error.message}` : 'No se pudieron guardar las fotos en Google Drive');
    }
  }
}

function publicRegistrationDraft(registration: PairRegistration) {
  const fields: Record<string, string | boolean> = {};
  for (const key of ['heardAboutSource', 'heardAboutOtherText', 'tournamentAvailabilityConfirmed', 'representingText', 'contactEmail'] as const) {
    fields[key] = registration[key] ?? '';
  }
  const photos: Record<string, string | null> = {};
  for (const prefix of ['playerOne', 'playerTwo', 'playerThree'] as const) {
    for (const suffix of ['Name', 'Dni', 'BirthDate', 'Phone', 'Instagram', 'ShirtSize', 'HasCommercialAgreement', 'CommercialAgreementDetails'] as const) {
      fields[`${prefix}${suffix}`] = registration[`${prefix}${suffix}`] ?? (suffix === 'ShirtSize' ? 'M' : suffix === 'HasCommercialAgreement' ? false : '');
    }
    photos[prefix] = registration[`${prefix}PhotoStoredName`] ? registration[`${prefix}PhotoOriginalName`] || 'Foto cargada' : null;
  }
  return { fields, photos, feePerPlayer: registration.feePerPlayer,
    coveredRosterSize: Math.max(registration.playerThreeName?.trim() ? 3 : 2, ...(registration.payments ?? []).filter((payment) => payment.amount > 0).map((payment) => payment.rosterSize)),
    paymentProofName: registration.paymentProofStoredName ? registration.paymentProofOriginalName || 'Comprobante cargado' : null };
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

function collectAffectedMatchIds(
  matches: TournamentMatch[],
  registrationIds: Set<number>,
  zoneIds: Set<number>,
) {
  const affected = new Set(matches.filter((match) =>
    (match.homeRegistrationId !== null && registrationIds.has(match.homeRegistrationId))
    || (match.awayRegistrationId !== null && registrationIds.has(match.awayRegistrationId))
    || (match.winnerRegistrationId !== null && registrationIds.has(match.winnerRegistrationId))
    || (match.homeQualifierZoneId !== null && zoneIds.has(match.homeQualifierZoneId))
    || (match.awayQualifierZoneId !== null && zoneIds.has(match.awayQualifierZoneId)),
  ).map((match) => match.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const match of matches) {
      if (affected.has(match.id)) continue;
      if (
        (match.homeSourceMatchId !== null && affected.has(match.homeSourceMatchId))
        || (match.awaySourceMatchId !== null && affected.has(match.awaySourceMatchId))
      ) {
        affected.add(match.id);
        changed = true;
      }
    }
  }
  return affected;
}
