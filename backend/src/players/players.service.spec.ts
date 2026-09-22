import { StreamableFile } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayersService } from './players.service';
import { existsSync, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
vi.mock('./player.entity', () => ({ Player: class Player {} }));
vi.mock('../localities/locality.entity', () => ({ Locality: class Locality {} }));
vi.mock('../registrations/pair-registration.entity', () => ({ PairRegistration: class PairRegistration {} }));
vi.mock('../tournaments/tournament.entity', () => ({ Tournament: class Tournament {} }));
vi.mock('../tournaments/zone.entity', () => ({ Zone: class Zone {} }));
vi.mock('../tournaments/zone-entry.entity', () => ({ ZoneEntry: class ZoneEntry {} }));
vi.mock('../registrations/google-drive-photo-storage.service', () => ({ GoogleDrivePhotoStorageService: class GoogleDrivePhotoStorageService {} }));
vi.mock('node:fs', async (original) => ({ ...await original<typeof import('node:fs')>(), existsSync: vi.fn(), createReadStream: vi.fn() }));

function setup(storedName = 'drive:photo-id') {
  const player = { id: 4, dni: '12345678', fullName: 'Test player' };
  const registration = { playerOneName: player.fullName, playerOneDni: player.dni, playerOnePhotoStoredName: storedName, playerOnePhotoOriginalName: 'photo.webp', playerOnePhotoMimeType: 'image/webp' };
  const query = { orderBy: vi.fn().mockReturnThis(), getMany: vi.fn(async () => [player]), leftJoinAndSelect: vi.fn().mockReturnThis() };
  const players = { findOne: vi.fn(async () => player), createQueryBuilder: vi.fn(() => query) };
  const registrations = { find: vi.fn(async () => [registration]) };
  const tournaments = { findOne: vi.fn().mockResolvedValue(null) };
  const zones = { find: vi.fn().mockResolvedValue([]) };
  const zoneEntries = { find: vi.fn().mockResolvedValue([]) };
  const drive = { download: vi.fn(async () => Buffer.from('photo-content')) };
  const service = new PlayersService(players as never, {} as never, registrations as never, tournaments as never, zones as never, zoneEntries as never, drive as never);
  return { service, registrations, tournaments, zones, zoneEntries, drive, registration, player, query };
}

afterEach(() => vi.restoreAllMocks());

describe('registered player agreements', () => {
  it('uses the latest registration category and falls back to the locality category for manual players', async () => {
    const { service, registrations, query, player } = setup();
    vi.spyOn(service, 'syncRegistrationPlayers').mockResolvedValue();
    query.getMany.mockResolvedValue([
      player,
      { id: 5, dni: '222', fullName: 'Manual', locality: { category: { name: 'Damas B' } } },
      { id: 6, dni: '333', fullName: 'Sin equipo', locality: null },
    ] as never);
    registrations.find.mockResolvedValue([
      { playerOneDni: player.dni, playerOneName: player.fullName, category: { name: 'Damas A' } },
      { playerTwoDni: player.dni, playerTwoName: player.fullName, category: { name: 'Silvina Cimadamore' } },
    ] as never);
    const result = await service.list({});
    expect(result.map((item) => item.categoryName)).toEqual(['Silvina Cimadamore', 'Damas B', null]);
    expect(registrations.find).toHaveBeenCalledWith(expect.objectContaining({ relations: { category: true } }));
  });

  it('matches each player by DNI, including the third player, and uses the latest declaration', async () => {
    const { service, registrations, query, player } = setup();
    vi.spyOn(service, 'syncRegistrationPlayers').mockResolvedValue();
    query.getMany.mockResolvedValue([player, { id: 5, dni: '222', fullName: 'Two' }, { id: 6, dni: '333', fullName: 'Three' }, { id: 7, dni: '444', fullName: 'Manual' }]);
    registrations.find.mockResolvedValue([
      { playerOneDni: player.dni, playerOneName: player.fullName, playerOneHasCommercialAgreement: true, playerOneCommercialAgreementDetails: 'Dabber', playerTwoDni: '222', playerTwoName: 'Two', playerTwoHasCommercialAgreement: true, playerTwoCommercialAgreementDetails: 'Guastavino', playerThreeDni: '333', playerThreeName: 'Three', playerThreeHasCommercialAgreement: true, playerThreeCommercialAgreementDetails: 'Otra' },
      { playerTwoDni: player.dni, playerTwoName: player.fullName, playerTwoHasCommercialAgreement: false, playerTwoCommercialAgreementDetails: 'Dabber' },
    ] as never);
    const result = await service.list({});
    expect(result.map(({ hasCommercialAgreement, commercialAgreementDetails }) => [hasCommercialAgreement, commercialAgreementDetails])).toEqual([[false, null], [true, 'Guastavino'], [true, 'Otra'], [null, null]]);
  });

  it('returns the same shirt model and color calculated for the active tournament', async () => {
    const { service, registrations, tournaments, zones, zoneEntries, query, player } = setup();
    vi.spyOn(service, 'syncRegistrationPlayers').mockResolvedValue();
    query.getMany.mockResolvedValue([player]);
    registrations.find.mockResolvedValue([{
      id: 9, categoryId: 1, category: { name: 'Damas A' }, localityName: 'Equipo',
      playerOneName: player.fullName, playerOneDni: player.dni, playerOneShirtSize: 'M',
      playerOneHasCommercialAgreement: true, playerOneCommercialAgreementDetails: 'Guastavino',
    }] as never);
    tournaments.findOne.mockResolvedValue({ id: 3 });
    zones.find.mockResolvedValue([{ id: 5, name: 'A', tournamentCategory: { categoryId: 1 } }]);
    zoneEntries.find.mockResolvedValue([{ zoneId: 5, registrationId: 9, seed: 1 }]);
    await expect(service.list({})).resolves.toEqual([expect.objectContaining({ shirtModel: 'Guastavino Color 1' })]);
  });

  it('includes the declared brand in the full export and leaves the insurance export focused on identity', async () => {
    const { service } = setup();
    vi.spyOn(service, 'list').mockResolvedValue([{ id: 4, fullName: 'Test', dni: '12345678', birthDate: '1980-04-03', hasCommercialAgreement: true, commercialAgreementDetails: 'Dabber', createdAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-01') }] as never);
    const full = await service.export('full');
    expect(full.content).toContain('"Marca / acuerdo"');
    expect(full.content).toContain('"Dabber"');
    const insurance = await service.export('insurance');
    expect(insurance.content).not.toContain('Dabber');
    expect(insurance.content).toContain('1980-04-03');
  });
});

describe('registered player photos', () => {
  it('lists photos already saved in registrations without changing the player record', async () => {
    const { service } = setup();
    vi.spyOn(service, 'syncRegistrationPlayers').mockResolvedValue();
    expect(await service.list({})).toEqual([expect.objectContaining({ id: 4, hasPhoto: true })]);
  });
  it('retrieves private Drive photos through the backend', async () => {
    const { service, drive } = setup();
    const file = await service.getPhoto(4);
    expect(drive.download).toHaveBeenCalledWith('drive:photo-id');
    expect(file).toMatchObject({ filename: 'photo.webp', contentType: 'image/webp' });
    expect(file.stream).toBeInstanceOf(StreamableFile);
  });
  it('reads a local photo and reports a missing file', async () => {
    const { service, drive } = setup('photo.webp');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(createReadStream).mockReturnValue(Readable.from('photo-content') as never);
    expect((await service.getPhoto(4)).stream).toBeInstanceOf(StreamableFile);
    expect(drive.download).not.toHaveBeenCalled();
    vi.mocked(existsSync).mockReturnValue(false);
    await expect(service.getPhoto(4)).rejects.toThrow('no esta disponible');
  });
  it('does not return another player photo or permit stored paths outside the photo directory', async () => {
    const { service, registration } = setup('../outside.webp');
    await expect(service.getPhoto(4)).rejects.toThrow('Foto no encontrada');
    registration.playerOneDni = '87654321';
    await expect(service.getPhoto(4)).rejects.toThrow('no tiene foto');
  });
});

describe('registration player synchronization', () => {
  it('does not recreate an old locality after its team was renamed when players already exist', async () => {
    const players = { findOne: vi.fn().mockResolvedValue({ id: 1, dni: '123' }), save: vi.fn() };
    const localities = { findOne: vi.fn(), save: vi.fn() };
    const service = new PlayersService(players as never, localities as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await service.syncRegistrationPlayers({
      localityName: 'Nombre anterior', provinceName: 'Buenos Aires',
      playerOneName: 'Ana', playerOneDni: '123',
      playerTwoName: 'Bea', playerTwoDni: '456',
      playerThreeName: null, playerThreeDni: null,
    } as never);
    expect(players.findOne).toHaveBeenCalledTimes(2);
    expect(localities.findOne).not.toHaveBeenCalled();
    expect(localities.save).not.toHaveBeenCalled();
  });
});
