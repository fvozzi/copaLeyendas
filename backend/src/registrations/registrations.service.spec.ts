import { BadGatewayException, BadRequestException, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreatePublicRegistrationDto } from './dto/create-public-registration.dto';
import { RegistrationAccessGrant } from './registration-access-grant.entity';
import { RegistrationAccessGrantStatus, RegistrationStatus } from './registration.enums';
import { RegistrationsService } from './registrations.service';

vi.mock('./pair-registration.entity', () => ({ PairRegistration: class PairRegistration {} }));
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
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    save: vi.fn(async (_entity, registration) => ({ ...registration, id: 10 })),
  };
  const registrations = {
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
    expect(grants.update).toHaveBeenCalledWith(7, { whatsappSentAt: result.whatsappSentAt });
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
      { id: 7, status: RegistrationAccessGrantStatus.ACTIVE },
      { status: RegistrationAccessGrantStatus.USED, consumedAt: expect.any(Date) });
    expect(manager.save).toHaveBeenCalledOnce();
  });

  it('does not save a second registration when another request has consumed the token', async () => {
    const { service, manager, players } = setup();
    manager.update.mockResolvedValue({ affected: 0 });
    await expect(service.createPublic(registrationDto)).rejects.toThrow(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
    expect(players.syncRegistrationPlayers).not.toHaveBeenCalled();
  });
});
