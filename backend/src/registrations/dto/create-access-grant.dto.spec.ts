import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateAccessGrantDto } from './create-access-grant.dto';

const validGrant = {
  localityId: 1,
  contactName: 'Facundo',
  contactPhone: '+54 9 11 1234-5678',
};

describe('CreateAccessGrantDto', () => {
  it('accepts an empty optional contact email', async () => {
    const dto = plainToInstance(CreateAccessGrantDto, {
      ...validGrant,
      contactEmail: '',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.contactEmail).toBeUndefined();
  });

  it('requires the contact name and WhatsApp number', async () => {
    const dto = plainToInstance(CreateAccessGrantDto, {
      localityId: 1,
      contactEmail: '',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['contactName', 'contactPhone']),
    );
  });
});
