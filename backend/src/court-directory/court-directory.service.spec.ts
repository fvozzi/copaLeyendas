import { describe, expect, it, vi } from 'vitest';
import { CommunityPlayerGender } from './community-court-player-group.entity';
import { CommunityCourtType, TrinquetShareMaterial } from './community-court.entity';
import { CourtDirectoryService } from './court-directory.service';

const court = (overrides = {}) => ({
  id: 1, name: 'Club Paraná', country: 'Argentina', province: 'Entre Ríos', locality: 'Paraná', address: 'Centro',
  latitude: -31.73, longitude: -60.53, lengthMeters: 30, widthMeters: 10, active: true, createdAt: new Date(),
  courtType: CommunityCourtType.TRINQUET, trinquetShareMaterial: TrinquetShareMaterial.WOOD, trinquetShareMaterialOther: null,
  frontonWallOrientation: null, frontonHasCacerola: null, frontonBackType: null, frontonReboundMaterial: null,
  playerGroups: [{ id: 1, gender: CommunityPlayerGender.FEMALE, minAge: 18, maxAge: 59, playerCount: 24 }],
  ...overrides,
});

describe('community court directory', () => {
  it('filters by accent-insensitive text, gender and a target age', async () => {
    const repository = { find: vi.fn(async () => [court(), court({ id: 2, name: 'Frontón Sur', country: 'Uruguay', province: 'Montevideo', locality: 'Montevideo', playerGroups: [{ id: 2, gender: CommunityPlayerGender.MALE, minAge: 60, maxAge: 80, playerCount: 12 }] })]) };
    const service = new CourtDirectoryService(repository as never);

    await expect(service.list({ search: 'parana', gender: CommunityPlayerGender.FEMALE, age: 40 })).resolves.toMatchObject([{ id: 1, totalPlayers: 24 }]);
    await expect(service.list({ gender: CommunityPlayerGender.FEMALE, age: 70 })).resolves.toEqual([]);
    await expect(service.list({ country: 'Uruguay', age: 70 })).resolves.toMatchObject([{ id: 2, totalPlayers: 12 }]);
  });

  it('rejects an inverted age range before saving', async () => {
    const repository = { create: vi.fn(), save: vi.fn() };
    const service = new CourtDirectoryService(repository as never);
    await expect(service.create({
      name: 'Cancha', country: 'Argentina', province: 'Buenos Aires', locality: 'Azul', latitude: -36.77, longitude: -59.85,
      courtType: CommunityCourtType.TRINQUET, trinquetShareMaterial: TrinquetShareMaterial.WOOD,
      playerGroups: [{ gender: CommunityPlayerGender.MIXED, minAge: 60, maxAge: 18, playerCount: 10 }],
    })).rejects.toThrow('edad mínima');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
