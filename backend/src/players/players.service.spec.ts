import { StreamableFile } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayersService } from './players.service';
import { existsSync, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { ShirtSize } from '../registrations/registration.enums';
vi.mock('./player.entity', () => ({ Player: class Player {} }));
vi.mock('../localities/locality.entity', () => ({ Locality: class Locality {} }));
vi.mock('../registrations/pair-registration.entity', () => ({ PairRegistration: class PairRegistration {} }));
vi.mock('../tournaments/tournament.entity', () => ({ Tournament: class Tournament {} }));
vi.mock('../tournaments/zone.entity', () => ({ Zone: class Zone {} }));
vi.mock('../tournaments/zone-entry.entity', () => ({ ZoneEntry: class ZoneEntry {} }));
vi.mock('../registrations/google-drive-photo-storage.service', () => ({ GoogleDrivePhotoStorageService: class GoogleDrivePhotoStorageService {} }));
vi.mock('node:fs', async (original) => ({ ...await original<typeof import('node:fs')>(), existsSync: vi.fn(), createReadStream: vi.fn() }));

function setup(storedName = 'drive:photo-id') {
  const player = { id: 4, dni: '12345678', fullName: 'Test player', shirtModel: null as string | null };
  const registration = { playerOneName: player.fullName, playerOneDni: player.dni, playerOnePhotoStoredName: storedName, playerOnePhotoOriginalName: 'photo.webp', playerOnePhotoMimeType: 'image/webp' };
  const query = { orderBy: vi.fn().mockReturnThis(), getMany: vi.fn(async () => [player]), leftJoinAndSelect: vi.fn().mockReturnThis() };
  const players = { findOne: vi.fn(async () => player), createQueryBuilder: vi.fn(() => query), update: vi.fn().mockResolvedValue({ affected: 1 }) };
  const registrations = { find: vi.fn(async () => [registration]) };
  const tournaments = { findOne: vi.fn().mockResolvedValue(null) };
  const zones = { find: vi.fn().mockResolvedValue([]) };
  const zoneEntries = { find: vi.fn().mockResolvedValue([]) };
  const drive = { download: vi.fn(async () => Buffer.from('photo-content')) };
  const service = new PlayersService(players as never, {} as never, registrations as never, tournaments as never, zones as never, zoneEntries as never, drive as never);
  return { service, players, registrations, tournaments, zones, zoneEntries, drive, registration, player, query };
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
    expect(registrations.find).toHaveBeenCalledWith(expect.objectContaining({ relations: { category: true, locality: true } }));
  });

  it('matches each player by DNI, including the third player, and uses the latest declaration', async () => {
    const { service, registrations, query, player } = setup();
    vi.spyOn(service, 'syncRegistrationPlayers').mockResolvedValue();
    query.getMany.mockResolvedValue([player, { id: 5, dni: '222', fullName: 'Two', shirtModel: null }, { id: 6, dni: '333', fullName: 'Three', shirtModel: null }, { id: 7, dni: '444', fullName: 'Manual', shirtModel: null }]);
    registrations.find.mockResolvedValue([
      { playerOneDni: player.dni, playerOneName: player.fullName, playerOneHasCommercialAgreement: true, playerOneCommercialAgreementDetails: 'Dabber', playerTwoDni: '222', playerTwoName: 'Two', playerTwoHasCommercialAgreement: true, playerTwoCommercialAgreementDetails: 'Guastavino', playerThreeDni: '333', playerThreeName: 'Three', playerThreeHasCommercialAgreement: true, playerThreeCommercialAgreementDetails: 'Otra' },
      { playerTwoDni: player.dni, playerTwoName: player.fullName, playerTwoHasCommercialAgreement: false, playerTwoCommercialAgreementDetails: 'Dabber' },
    ] as never);
    const result = await service.list({});
    expect(result.map(({ hasCommercialAgreement, commercialAgreementDetails }) => [hasCommercialAgreement, commercialAgreementDetails])).toEqual([[false, null], [true, 'Guastavino'], [true, 'Otra'], [null, null]]);
  });

  it('returns the same shirt model and color calculated for the active tournament', async () => {
    const { service, players, registrations, tournaments, zones, zoneEntries, query, player } = setup();
    vi.spyOn(service, 'syncRegistrationPlayers').mockResolvedValue();
    query.getMany.mockResolvedValue([player]);
    registrations.find.mockResolvedValue([{
      id: 9, categoryId: 1, category: { name: 'Damas A' }, locality: { name: 'Equipo' },
      playerOneName: player.fullName, playerOneDni: player.dni, playerOneShirtSize: 'M',
      playerOneHasCommercialAgreement: true, playerOneCommercialAgreementDetails: 'Guastavino',
    }] as never);
    tournaments.findOne.mockResolvedValue({ id: 3 });
    zones.find.mockResolvedValue([{ id: 5, name: 'A', tournamentCategory: { categoryId: 1 } }]);
    zoneEntries.find.mockResolvedValue([{ zoneId: 5, registrationId: 9, seed: 1 }]);
    await expect(service.list({})).resolves.toEqual([expect.objectContaining({ shirtModel: 'Guastavino Color 1' })]);
    expect(players.update).toHaveBeenCalledWith(expect.objectContaining({ id: player.id }), { shirtModel: 'Guastavino Color 1' });
  });

  it('keeps a manually edited shirt model instead of recalculating it', async () => {
    const { service, players, registrations, query, player } = setup();
    vi.spyOn(service, 'syncRegistrationPlayers').mockResolvedValue();
    player.shirtModel = 'Dabber Color 4';
    query.getMany.mockResolvedValue([player]);
    registrations.find.mockResolvedValue([{
      id: 9, categoryId: 1, category: { name: 'Damas A' }, locality: { name: 'Equipo' },
      playerOneName: player.fullName, playerOneDni: player.dni, playerOneShirtSize: 'M',
      playerOneHasCommercialAgreement: true, playerOneCommercialAgreementDetails: 'Guastavino',
    }] as never);
    await expect(service.list({})).resolves.toEqual([expect.objectContaining({ shirtModel: 'Dabber Color 4' })]);
    expect(players.update).not.toHaveBeenCalled();
  });

  it('includes the declared brand in the full export and leaves the insurance export focused on identity', async () => {
    const { service } = setup();
    vi.spyOn(service, 'list').mockResolvedValue([{ id: 4, fullName: 'Test', dni: '12345678', birthDate: '1980-04-03', hasCommercialAgreement: true, commercialAgreementDetails: 'Dabber', shirtModel: 'Dabber Color 4', createdAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-01') }] as never);
    const full = await service.export('full');
    expect(full.content).toContain('"Marca / acuerdo"');
    expect(full.content).toContain('"Dabber"');
    expect(full.content).toContain('"Modelo asignado"');
    expect(full.content).toContain('"Dabber Color 4"');
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
  it('does not recreate a manually deleted player while listing registrations', async () => {
    const { service, registrations, query } = setup();
    query.getMany.mockResolvedValue([]);
    registrations.find.mockResolvedValue([{
      id: 9, playerOneName: 'Eliminada', playerOneDni: '12345678',
      localityId: 4, category: { name: 'Damas A' }, locality: { name: 'Equipo' },
    }] as never);
    const synchronize = vi.spyOn(service, 'syncRegistrationPlayers');
    await expect(service.list({})).resolves.toEqual([]);
    expect(synchronize).not.toHaveBeenCalled();
  });

  it('persists an explicit unassignment and an explicit deletion', async () => {
    const player = { id: 4, dni: '12345678', fullName: 'Jugadora', localityId: 7, locality: { id: 7, name: 'Equipo anterior' } };
    const players = { findOne: vi.fn(async () => player), find: vi.fn().mockResolvedValue([]), save: vi.fn(async (value) => value), remove: vi.fn(async () => player) };
    const registrations = { count: vi.fn().mockResolvedValue(0), find: vi.fn().mockResolvedValue([]) };
    const service = new PlayersService(players as never, {} as never, registrations as never, {} as never, {} as never, {} as never, {} as never);
    await service.update(4, { localityId: null });
    expect(players.save).toHaveBeenCalledWith(expect.objectContaining({ id: 4, localityId: null, locality: null }));
    await expect(service.remove(4)).resolves.toEqual({ success: true });
    expect(players.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
  });

  it('keeps existing players linked to the locality referenced by their registration', async () => {
    const players = { findOne: vi.fn().mockResolvedValue({ id: 1, dni: '123', localityId: 2 }), find: vi.fn().mockResolvedValue([]), save: vi.fn() };
    const localities = { findOne: vi.fn(), save: vi.fn() };
    const registrations = { find: vi.fn().mockResolvedValue([]) };
    const service = new PlayersService(players as never, localities as never, registrations as never, {} as never, {} as never, {} as never, {} as never);
    await service.syncRegistrationPlayers({
      localityId: 9,
      playerOneName: 'Ana', playerOneDni: '123',
      playerTwoName: 'Bea', playerTwoDni: '456',
      playerThreeName: null, playerThreeDni: null,
    } as never);
    expect(players.findOne).toHaveBeenCalledTimes(2);
    expect(players.save).toHaveBeenCalledWith(expect.objectContaining({ dni: '123', localityId: 9 }));
    expect(localities.findOne).not.toHaveBeenCalled();
    expect(localities.save).not.toHaveBeenCalled();
  });

  it('uses the current team roster to replace a stale registration player', async () => {
    const monica = { id: 8, fullName: 'Monica Torres', dni: '23175871', birthDate: '1973-07-26', phone: null, instagram: null, shirtSize: 'S', localityId: 4 };
    const pia = { id: 9, fullName: 'Pia Volpi', dni: '53954143', birthDate: '2003-02-24', phone: '091046119', instagram: 'pia_volpi', shirtSize: 'M', localityId: 4 };
    const registration = {
      id: 12, localityId: 4,
      playerOneName: 'Camila Ocampo', playerOneDni: '11111111', playerOneBirthDate: '1990-01-01', playerOnePhone: 'old', playerOneInstagram: null, playerOneShirtSize: 'M',
      playerOneHasCommercialAgreement: true, playerOneCommercialAgreementDetails: 'Marca anterior', playerOnePhotoStoredName: 'camila.webp',
      playerTwoName: pia.fullName, playerTwoDni: pia.dni, playerTwoBirthDate: pia.birthDate, playerTwoPhone: pia.phone, playerTwoInstagram: pia.instagram, playerTwoShirtSize: pia.shirtSize,
      playerThreeName: null, playerThreeDni: null,
    };
    const players = { create: vi.fn((value) => value), save: vi.fn(async () => monica), find: vi.fn().mockResolvedValue([monica, pia]) };
    const localities = { findOne: vi.fn().mockResolvedValue({ id: 4 }) };
    const registrations = { find: vi.fn().mockResolvedValue([registration]), save: vi.fn(async (value) => value) };
    const service = new PlayersService(players as never, localities as never, registrations as never, {} as never, {} as never, {} as never, {} as never);

    await service.create({ fullName: monica.fullName, dni: monica.dni, birthDate: monica.birthDate, shirtSize: ShirtSize.S, localityId: 4 });

    expect(registrations.save).toHaveBeenCalledWith(expect.objectContaining({
      playerOneName: 'Monica Torres', playerOneDni: '23175871',
      playerTwoName: 'Pia Volpi', playerTwoDni: '53954143',
      playerOneHasCommercialAgreement: false, playerOneCommercialAgreementDetails: null, playerOnePhotoStoredName: null,
    }));
  });

  it('prevents deleting a registered player until a replacement makes the roster valid', async () => {
    const player = { id: 4, dni: '12345678', fullName: 'Titular', localityId: 7, locality: { id: 7 } };
    const players = { findOne: vi.fn(async () => player), count: vi.fn().mockResolvedValue(1), remove: vi.fn() };
    const registrations = { count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1) };
    const service = new PlayersService(players as never, {} as never, registrations as never, {} as never, {} as never, {} as never, {} as never);

    await expect(service.remove(4)).rejects.toThrow('Agregá primero su reemplazo');
    expect(players.remove).not.toHaveBeenCalled();
  });
});
