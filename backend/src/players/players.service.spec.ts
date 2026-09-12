import { StreamableFile } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayersService } from './players.service';
import { existsSync, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
vi.mock('./player.entity', () => ({ Player: class Player {} }));
vi.mock('../localities/locality.entity', () => ({ Locality: class Locality {} }));
vi.mock('../registrations/pair-registration.entity', () => ({ PairRegistration: class PairRegistration {} }));
vi.mock('../registrations/google-drive-photo-storage.service', () => ({ GoogleDrivePhotoStorageService: class GoogleDrivePhotoStorageService {} }));
vi.mock('node:fs', async (original) => ({ ...await original<typeof import('node:fs')>(), existsSync: vi.fn(), createReadStream: vi.fn() }));

function setup(storedName = 'drive:photo-id') {
  const player = { id: 4, dni: '12345678', fullName: 'Test player' };
  const registration = { playerOneName: player.fullName, playerOneDni: player.dni, playerOnePhotoStoredName: storedName, playerOnePhotoOriginalName: 'photo.webp', playerOnePhotoMimeType: 'image/webp' };
  const query = { orderBy: vi.fn().mockReturnThis(), getMany: vi.fn(async () => [player]), leftJoinAndSelect: vi.fn().mockReturnThis() };
  const players = { findOne: vi.fn(async () => player), createQueryBuilder: vi.fn(() => query) };
  const registrations = { find: vi.fn(async () => [registration]) };
  const drive = { download: vi.fn(async () => Buffer.from('photo-content')) };
  const service = new PlayersService(players as never, {} as never, registrations as never, drive as never);
  return { service, registrations, drive, registration, player, query };
}

afterEach(() => vi.restoreAllMocks());

describe('registered player agreements', () => {
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
