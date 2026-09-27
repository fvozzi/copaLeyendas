import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { Category } from '../categories/category.entity';
import { Locality } from './locality.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { LocalitiesService } from './localities.service';

vi.mock('./locality.entity', () => ({ Locality: class Locality {} }));
vi.mock('../categories/category.entity', () => ({ Category: class Category {} }));
vi.mock('../registrations/registration-access-grant.entity', () => ({ RegistrationAccessGrant: class RegistrationAccessGrant {} }));

function setup() {
  const manager = {
    transaction: vi.fn(async (callback: (manager: unknown) => Promise<unknown>) => callback(manager)),
    find: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const localities = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => value),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    manager,
  };
  const categories = { findOne: vi.fn(async ({ where }) => ({ id: where.id })) };
  const grants = { count: vi.fn().mockResolvedValue(0) };
  const service = new LocalitiesService(
    localities as unknown as Repository<Locality>,
    categories as unknown as Repository<Category>,
    grants as unknown as Repository<RegistrationAccessGrant>,
  );
  return { service, localities, manager, grants };
}

const existing = { id: 1, name: 'Junin', provinceName: 'Buenos Aires', categoryId: 1, active: true };

describe('LocalitiesService duplicate prevention', () => {
  it('rejects an existing team despite case and spacing differences', async () => {
    const { service, localities } = setup();
    localities.find.mockResolvedValue([existing]);
    await expect(service.create({ name: ' JUNIN ', provinceName: 'Buenos   aires', categoryId: 1 }))
      .rejects.toThrow(ConflictException);
    expect(localities.manager.update).not.toHaveBeenCalled();
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
    const { service, localities, manager } = setup();
    localities.findOne.mockResolvedValue({ ...existing });
    await service.update(1, { active: false });
    expect(localities.find).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(Locality, 1, expect.objectContaining({ active: false }));
  });

  it('updates the referenced team without copying its name into related records', async () => {
    const { service, localities, manager } = setup();
    localities.findOne.mockResolvedValue({ ...existing });
    await service.update(1, { name: 'Junin Centro' });
    expect(manager.update).toHaveBeenCalledWith(Locality, 1, expect.objectContaining({ name: 'Junin Centro' }));
    expect(manager.update).toHaveBeenCalledTimes(1);
    expect(localities.save).not.toHaveBeenCalled();
  });

  it('does not move a registered team to another category', async () => {
    const { service, localities, manager } = setup();
    localities.findOne.mockResolvedValue({ ...existing });
    manager.count.mockResolvedValue(1);
    await expect(service.update(1, { categoryId: 2 })).rejects.toThrow(BadRequestException);
    expect(manager.update).not.toHaveBeenCalledWith(Locality, expect.anything(), expect.anything());
  });

  it('deletes an unreferenced team and reports when a grant prevents deletion', async () => {
    const { service, localities, grants } = setup();
    localities.findOne.mockResolvedValue({ ...existing });
    await expect(service.remove(1)).resolves.toEqual({ success: true });
    expect(localities.delete).toHaveBeenCalledWith(1);
    grants.count.mockResolvedValue(1);
    await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    expect(localities.delete).toHaveBeenCalledTimes(1);
  });
});
