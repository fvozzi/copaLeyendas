import { BadGatewayException, BadRequestException, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreatePublicRegistrationDto } from './dto/create-public-registration.dto';
import { RegistrationAccessGrant } from './registration-access-grant.entity';
import { PairRegistration } from './pair-registration.entity';
import { RegistrationPayment } from './registration-payment.entity';
import { RegistrationAccessGrantStatus, RegistrationStatus } from './registration.enums';
import { RegistrationsService } from './registrations.service';

vi.mock('./pair-registration.entity', () => ({ PairRegistration: class PairRegistration {} }));
vi.mock('./registration-payment.entity', () => ({ RegistrationPayment: class RegistrationPayment {} }));
vi.mock('./registration-access-grant.entity', () => ({ RegistrationAccessGrant: class RegistrationAccessGrant {} }));
vi.mock('../localities/locality.entity', () => ({ Locality: class Locality {} }));
vi.mock('../tournaments/tournament.entity', () => ({ Tournament: class Tournament {} }));
vi.mock('../categories/category.entity', () => ({ Category: class Category {} }));
vi.mock('../players/players.service', () => ({ PlayersService: class PlayersService {} }));
vi.mock('./google-drive-photo-storage.service', () => ({ GoogleDrivePhotoStorageService: class GoogleDrivePhotoStorageService {} }));
vi.mock('./payment-proof-storage', () => ({ ensurePaymentProofDir: vi.fn() }));

function setup() {
  const grant = {
    id: 7, token: 'COPA-EXAMPLE1', status: RegistrationAccessGrantStatus.ACTIVE,
    categoryId: 1, category: { name: 'Damas A' }, localityName: 'Junin',
    contactName: 'Contacto', contactPhone: '+5491112345678', feeWaived: true,
    whatsappSentAt: null,
  };
  const grants = { findOne: vi.fn().mockResolvedValue(grant), update: vi.fn().mockResolvedValue({ affected: 1 }) };
  const manager = {
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((_entity, value) => value),
    findOne: vi.fn(async (entity) => entity === RegistrationAccessGrant ? grant : null),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    save: vi.fn(async (_entity, registration) => ({ ...registration, id: 10 })),
  };
  const registrations = {
    findOne: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0), create: vi.fn((value) => value),
    manager: { transaction: vi.fn(async (callback) => callback(manager)) },
  };
  const players = { syncRegistrationPlayers: vi.fn().mockResolvedValue(undefined) };
  const whatsapp = { sendRegistrationToken: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid.test' }] }) };
  const service = new RegistrationsService(
    registrations as never, grants as never, {} as never,
    { findOne: vi.fn().mockResolvedValue(null) } as never, {} as never,
    players as never, { enabled: () => false } as never, whatsapp as never,
  );
  return { service, grant, grants, manager, registrations, players, whatsapp };
}

const registrationDto = {
  accessToken: 'COPA-EXAMPLE1', tournamentAvailabilityConfirmed: true,
  representingText: 'Junin', playerOneName: 'Uno', playerOneDni: '10000001', playerOnePhone: '1112345678',
  playerTwoName: 'Dos', playerTwoDni: '10000002', playerTwoPhone: '1112345679',
} as CreatePublicRegistrationDto;

describe('registration tracking', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('persists the accepted send time without overwriting a token consumed during the send', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T23:05:00Z'));
    const { service, grant, grants, whatsapp } = setup();
    whatsapp.sendRegistrationToken.mockImplementation(async () => {
      grant.status = RegistrationAccessGrantStatus.USED;
      return { messages: [{ id: 'wamid.test' }] };
    });
    const result = await service.sendAccessGrantTokenByWhatsApp(7, 'https://copa.example.com');
    expect(result.whatsappSentAt.toISOString()).toBe('2026-09-09T23:05:00.000Z');
    expect(grants.update).toHaveBeenCalledWith(7, { whatsappSentAt: result.whatsappSentAt, whatsappMessageId: 'wamid.test' });
    expect(grant.status).toBe(RegistrationAccessGrantStatus.USED);
  });

  it('preserves the previous send time when Meta rejects a retry', async () => {
    const { service, grants, whatsapp } = setup();
    whatsapp.sendRegistrationToken.mockRejectedValue(new Error('Meta rechazo el mensaje'));
    await expect(service.sendAccessGrantTokenByWhatsApp(7, 'https://copa.example.com')).rejects.toThrow();
    expect(grants.update).not.toHaveBeenCalled();
  });

  it('does not record an accepted send without a message ID', async () => {
    const { service, grants, whatsapp } = setup();
    whatsapp.sendRegistrationToken.mockResolvedValue({ messages: [] });
    await expect(service.sendAccessGrantTokenByWhatsApp(7, 'https://copa.example.com')).rejects.toThrow(BadGatewayException);
    expect(grants.update).not.toHaveBeenCalled();
  });

  it('consumes the token when the registration is received even if player synchronization fails', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, manager, registrations, players } = setup();
    players.syncRegistrationPlayers.mockRejectedValue(new Error('Sync failed'));
    await expect(service.createPublic(registrationDto)).resolves.toMatchObject({ id: 10, status: RegistrationStatus.RECEIVED });
    expect(registrations.manager.transaction).toHaveBeenCalledOnce();
    expect(manager.update).toHaveBeenCalledWith(RegistrationAccessGrant,
      { id: 7 },
      { status: RegistrationAccessGrantStatus.USED, consumedAt: expect.any(Date) });
    expect(manager.save).toHaveBeenCalledOnce();
  });

  it('does not save a second registration when another request has consumed the token', async () => {
    const { service, manager, players } = setup();
    manager.findOne.mockResolvedValue({ status: RegistrationAccessGrantStatus.USED } as never);
    await expect(service.createPublic(registrationDto)).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
    expect(players.syncRegistrationPlayers).not.toHaveBeenCalled();
  });

  it('lets Direction reopen a used token without clearing its previous usage', async () => {
    const { service, grant, grants } = setup();
    grant.status = RegistrationAccessGrantStatus.USED;
    expect(await service.updateAccessGrantStatus(7, { status: RegistrationAccessGrantStatus.ACTIVE })).toMatchObject({ status: 'ACTIVE' });
    expect(grants.update).toHaveBeenCalledWith({ id: 7, status: 'USED' }, { status: 'ACTIVE' });
    await expect(service.updateAccessGrantStatus(7, { status: RegistrationAccessGrantStatus.USED })).rejects.toThrow(BadRequestException);
  });

  it('only returns editable data while the token is enabled, without internal notes or storage identifiers', async () => {
    const { service, grant, registrations } = setup();
    registrations.findOne.mockResolvedValue({ ...registrationDto, adminNotes: 'Private', paymentProofStoredName: 'secret.pdf', paymentProofOriginalName: 'pago.pdf', playerOnePhotoStoredName: 'drive:secret', playerOnePhotoOriginalName: 'foto.jpg' });
    const access = await service.getPublicAccessGrant(grant.token);
    expect(access.registration?.fields.playerOneName).toBe('Uno');
    expect(access.registration?.photos.playerOne).toBe('foto.jpg');
    expect(access.registration?.paymentProofName).toBe('pago.pdf');
    expect(JSON.stringify(access)).not.toMatch(/Private|secret|adminNotes|StoredName/);
    for (const status of [RegistrationAccessGrantStatus.USED, RegistrationAccessGrantStatus.REVOKED]) {
      grant.status = status;
      expect((await service.getPublicAccessGrant(grant.token)).registration).toBeNull();
    }
  });

  it('updates the same registration, preserves confirmation and files, and adds the substitute', async () => {
    const { service, grant, manager, players } = setup();
    grant.feeWaived = false;
    const previous = { ...registrationDto, id: 42, status: RegistrationStatus.CONFIRMED, adminNotes: 'Reviewed', feePerPlayer: 12000, paymentProofStoredName: 'pago.pdf', playerOnePhotoStoredName: 'drive:old' };
    manager.findOne.mockImplementation(async (entity) => (entity === RegistrationAccessGrant ? grant : previous) as never);
    const dto = { ...registrationDto, playerOneName: 'Nombre corregido', playerThreeName: 'Suplente', playerThreeDni: '33333333' };
    await expect(service.createPublic(dto)).rejects.toThrow('nuevo comprobante');
    expect(manager.save).not.toHaveBeenCalled();
    const result = await service.createPublic(dto, { paymentProof: { filename: 'extra.pdf', originalname: 'suplente.pdf', mimetype: 'application/pdf', size: 100 } as Express.Multer.File });
    expect(result.message).toContain('actualizada');
    expect(manager.save).toHaveBeenCalledWith(PairRegistration, expect.objectContaining({ id: 42, status: 'CONFIRMED', adminNotes: 'Reviewed', feePerPlayer: 12000, paymentProofStoredName: 'pago.pdf', playerOnePhotoStoredName: 'drive:old', playerOneName: 'Nombre corregido', playerThreeName: 'Suplente' }));
    expect(players.syncRegistrationPlayers).toHaveBeenCalledWith(expect.anything(), { manager, previous });
    expect(manager.save).toHaveBeenCalledWith(RegistrationPayment, expect.objectContaining({ kind: 'ADDITIONAL', players: 1, rosterSize: 3, amount: 12000, storedName: 'extra.pdf' }));
  });

  it('aborts a correction if synchronizing the players fails', async () => {
    const { service, grant, manager, players } = setup();
    manager.findOne.mockImplementation(async (entity) => (entity === RegistrationAccessGrant ? grant : { ...registrationDto, id: 42 }) as never);
    players.syncRegistrationPlayers.mockRejectedValue(new Error('Sync failed'));
    await expect(service.createPublic(registrationDto)).rejects.toThrow('Sync failed');
  });

  it('requires the added-player proof even for a deferred non-waived registration', async () => {
    const { service, grant, manager } = setup();
    const previous = { ...registrationDto, id: 42, feeWaived: false, paymentDeferredUntilConfirmed: true };
    manager.findOne.mockImplementation(async (entity) => (entity === RegistrationAccessGrant ? grant : previous) as never);
    await expect(service.createPublic({ ...registrationDto, playerThreeName: 'Suplente', playerThreeDni: '33333333' })).rejects.toThrow('nuevo comprobante');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('does not charge again for a substitute whose payment was already recorded', async () => {
    const { service, grant, manager } = setup();
    const previous = { ...registrationDto, id: 42, feeWaived: false, paymentProofStoredName: 'initial.pdf' };
    manager.findOne.mockImplementation(async (entity) => (entity === RegistrationAccessGrant ? grant : previous) as never);
    manager.find.mockResolvedValue([{ rosterSize: 3, amount: 15000 }]);
    await service.createPublic({ ...registrationDto, playerThreeName: 'Suplente', playerThreeDni: '33333333' });
    expect(manager.save).toHaveBeenCalledOnce();
    expect(manager.save.mock.calls[0][0]).toBe(PairRegistration);
  });

  it('rejects duplicate players before consuming the token', async () => {
    const { service, manager } = setup();
    await expect(service.createPublic({ ...registrationDto, playerTwoDni: registrationDto.playerOneDni })).rejects.toThrow('DNI diferentes');
    expect(manager.update).not.toHaveBeenCalled();
  });
});
