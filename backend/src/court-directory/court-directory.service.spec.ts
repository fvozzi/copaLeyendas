import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommunityPlayerGender } from './community-court-player-group.entity';
import { CommunityCourtColor, CommunityCourtOrganizationType, CommunityCourtType, CommunityFrontisFinish, FrontonTambur, TrinquetShareMaterial } from './community-court.entity';
import { CourtDirectoryService } from './court-directory.service';

afterEach(() => vi.unstubAllGlobals());

const court = (overrides = {}) => ({
  id: 1, name: 'Club Paraná', organizationType: CommunityCourtOrganizationType.CLUB, country: 'Argentina', province: 'Entre Ríos', locality: 'Paraná', address: 'Centro',
  latitude: -31.73, longitude: -60.53, lengthMeters: 30, widthMeters: 10, active: true, createdAt: new Date(),
  courtType: CommunityCourtType.TRINQUET, trinquetShareMaterial: TrinquetShareMaterial.WOOD, trinquetShareMaterialOther: null,
  frontisFinish: CommunityFrontisFinish.HARD, courtColor: CommunityCourtColor.WHITE, history: 'Fundada por la comunidad local.', inaugurationDate: '1950-05-10',
  contactName: 'Secretaría del club', contactPhone: '+54 9 11 1234-5678', contactEmail: 'club@example.com', contactUrl: 'https://example.com',
  hasSchool: true, hasCourtKeeper: true, photos: [],
  frontonWallOrientation: null, frontonTambur: null, frontonHasCacerola: null, frontonBackType: null, frontonReboundMaterial: null,
  playerGroups: [{ id: 1, gender: CommunityPlayerGender.FEMALE, minAge: 18, maxAge: 59, playerCount: 24 }],
  ...overrides,
});

describe('community court directory', () => {
  it('filters by accent-insensitive text, gender and a target age', async () => {
    const repository = { find: vi.fn(async () => [court(), court({ id: 2, name: 'Frontón Sur', country: 'Uruguay', province: 'Montevideo', locality: 'Montevideo', inaugurationDate: null, contactName: null, contactPhone: null, contactEmail: null, contactUrl: null, playerGroups: [{ id: 2, gender: CommunityPlayerGender.MALE, minAge: 60, maxAge: 80, playerCount: 12 }] })]) };
    const service = new CourtDirectoryService(repository as never, {} as never);

    await expect(service.list({ search: 'parana', gender: CommunityPlayerGender.FEMALE, age: 40 })).resolves.toMatchObject([{ id: 1, totalPlayers: 24 }]);
    await expect(service.list({ gender: CommunityPlayerGender.FEMALE, age: 70 })).resolves.toEqual([]);
    await expect(service.list({ country: 'Uruguay', age: 70 })).resolves.toMatchObject([{ id: 2, totalPlayers: 12 }]);
    await expect(service.list({ search: '1950' })).resolves.toMatchObject([{ id: 1 }]);
    await expect(service.list({ search: 'secretaria' })).resolves.toMatchObject([{ id: 1 }]);
  });

  it('rejects an inverted age range before saving', async () => {
    const repository = { create: vi.fn(), save: vi.fn() };
    const service = new CourtDirectoryService(repository as never, {} as never);
    await expect(service.create({
      name: 'Cancha', organizationType: CommunityCourtOrganizationType.CLUB, country: 'Argentina', province: 'Buenos Aires', locality: 'Azul', latitude: -36.77, longitude: -59.85,
      courtType: CommunityCourtType.TRINQUET, trinquetShareMaterial: TrinquetShareMaterial.WOOD,
      frontisFinish: CommunityFrontisFinish.HARD, courtColor: CommunityCourtColor.WHITE,
      hasSchool: false, hasCourtKeeper: false,
      playerGroups: [{ gender: CommunityPlayerGender.MIXED, minAge: 60, maxAge: 18, playerCount: 10 }],
    })).rejects.toThrow('edad mínima');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('geocodes through the identified backend request and caches repeated searches', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify([{ lat: '-36.77698', lon: '-59.85854', display_name: 'Azul, Buenos Aires, Argentina' }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new CourtDirectoryService({} as never, {} as never);

    await expect(service.geocode('Azul, Buenos Aires, Argentina', 'AR')).resolves.toEqual({ latitude: -36.77698, longitude: -59.85854, displayName: 'Azul, Buenos Aires, Argentina' });
    await service.geocode('Azul, Buenos Aires, Argentina', 'AR');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('countrycodes=ar');
    expect((options?.headers as Record<string, string>)['User-Agent']).toContain('CopaLeyendas');
  });
});
