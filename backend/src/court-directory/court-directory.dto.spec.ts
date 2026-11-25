import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCommunityCourtDto } from './court-directory.dto';

describe('community court multipart payload', () => {
  it('transforms JSON player groups and string booleans from FormData', async () => {
    const dto = plainToInstance(CreateCommunityCourtDto, {
      name: 'Club Central', country: 'Argentina', province: 'Buenos Aires', locality: 'Azul',
      courtType: 'FRONTON', frontisFinish: 'HARD', courtColor: 'BLUE', hasSchool: 'false',
      inaugurationDate: '1950-05-10',
      contactName: 'Secretaría del club', contactPhone: '+54 9 11 1234-5678', contactEmail: 'club@example.com', contactUrl: 'https://example.com',
      frontonWallOrientation: 'LEFT_LONG', frontonHasCacerola: 'false', frontonBackType: 'FREE_LIFT',
      latitude: '-36.77', longitude: '-59.85',
      playerGroups: JSON.stringify([{ gender: 'MIXED', minAge: null, maxAge: 17, playerCount: 20 }]),
    }, { enableImplicitConversion: true });

    expect(await validate(dto)).toEqual([]);
    expect(dto.hasSchool).toBe(false);
    expect(dto.frontonHasCacerola).toBe(false);
    expect(dto.playerGroups).toEqual([{ gender: 'MIXED', minAge: null, maxAge: 17, playerCount: 20 }]);
  });
});
