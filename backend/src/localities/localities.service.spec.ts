import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { Category } from '../categories/category.entity';
import { Locality } from './locality.entity';
import { LocalitiesService } from './localities.service';

vi.mock('./locality.entity', () => ({ Locality: class Locality {} }));
vi.mock('../categories/category.entity', () => ({ Category: class Category {} }));

function setup() {
  const localities = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => value),
  };
  const categories = { findOne: vi.fn(async ({ where }) => ({ id: where.id })) };
  const service = new LocalitiesService(
    localities as unknown as Repository<Locality>,
    categories as unknown as Repository<Category>,
  );
  return { service, localities };
}

const existing = { id: 1, name: 'Junin', provinceName: 'Buenos Aires', categoryId: 1, active: true };

describe('LocalitiesService duplicate prevention', () => {
  it('rejects an existing team despite case and spacing differences', async () => {
    const { service, localities } = setup();
    localities.find.mockResolvedValue([existing]);
    await expect(service.create({ name: ' JUNIN ', provinceName: 'Buenos   aires', categoryId: 1 }))
      .rejects.toThrow(ConflictException);
    expect(localities.save).not.toHaveBeenCalled();
  });

  it('scopes the duplicate lookup to the selected category', async () => {
    const { service, localities } = setup();
    await service.create({ name: 'Junin', provinceName: 'Buenos Aires', categoryId: 2 });
    expect(localities.find).toHaveBeenCalledWith({ where: { categoryId: 2 } });
    expect(localities.save).toHaveBeenCalled();
  });

  it('rejects editing a team into another existing team', async () => {
    const { service, localities } = setup();
    localities.findOne.mockResolvedValue({ ...existing, id: 2, name: 'Rosario' });
    localities.find.mockResolvedValue([existing]);
    await expect(service.update(2, { name: 'Junin' })).rejects.toThrow(ConflictException);
    expect(localities.save).not.toHaveBeenCalled();
  });

  it('allows deactivating a legacy duplicate without changing its identity', async () => {
    const { service, localities } = setup();
    localities.findOne.mockResolvedValue({ ...existing });
    await expect(service.update(1, { active: false })).resolves.toMatchObject({ active: false });
    expect(localities.find).not.toHaveBeenCalled();
  });
});
