import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ShirtSize } from '../../registrations/registration.enums';

export class CreatePlayerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  dni: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  instagram?: string;

  @IsOptional()
  @IsEnum(ShirtSize)
  shirtSize?: ShirtSize;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  localityId?: number | null;
}
