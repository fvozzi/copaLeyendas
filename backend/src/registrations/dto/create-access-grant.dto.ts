import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PairCategory } from '../registration.enums';

function toBoolean(value: unknown) {
  return value === true || value === 'true' || value === 'on';
}

export class CreateAccessGrantDto {
  @IsEnum(PairCategory)
  category: PairCategory;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  localityName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  provinceName: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  clubName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  feeWaived?: boolean;
}
