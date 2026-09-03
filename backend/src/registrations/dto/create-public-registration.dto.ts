import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { HeardAboutSource, ShirtSize } from '../registration.enums';

function toBoolean(value: unknown) {
  return value === true || value === 'true' || value === 'on';
}

export class CreatePublicRegistrationDto {
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  accessToken: string;

  @IsEnum(HeardAboutSource)
  heardAboutSource: HeardAboutSource;

  @ValidateIf((dto) => dto.heardAboutSource === HeardAboutSource.OTHER)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  heardAboutOtherText?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  tournamentAvailabilityConfirmed: boolean;

  @IsString()
  @MinLength(4)
  @MaxLength(180)
  representingText: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(140)
  playerOneName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  playerOneDni: string;

  @IsDateString()
  playerOneBirthDate: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  playerOnePhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  playerOneInstagram?: string;

  @IsEnum(ShirtSize)
  playerOneShirtSize: ShirtSize;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  playerOneHasCommercialAgreement: boolean;

  @ValidateIf((dto) => dto.playerOneHasCommercialAgreement)
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  playerOneCommercialAgreementDetails?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(140)
  playerTwoName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  playerTwoDni: string;

  @IsDateString()
  playerTwoBirthDate: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  playerTwoPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  playerTwoInstagram?: string;

  @IsEnum(ShirtSize)
  playerTwoShirtSize: ShirtSize;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  playerTwoHasCommercialAgreement: boolean;

  @ValidateIf((dto) => dto.playerTwoHasCommercialAgreement)
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  playerTwoCommercialAgreementDetails?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  playerThreeName?: string;

  @ValidateIf((dto) => Boolean(dto.playerThreeName?.trim()))
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  playerThreeDni?: string;

  @ValidateIf((dto) => Boolean(dto.playerThreeName?.trim()))
  @IsDateString()
  playerThreeBirthDate?: string;

  @ValidateIf((dto) => Boolean(dto.playerThreeName?.trim()))
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  playerThreePhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  playerThreeInstagram?: string;

  @ValidateIf((dto) => Boolean(dto.playerThreeName?.trim()))
  @IsEnum(ShirtSize)
  playerThreeShirtSize?: ShirtSize;

  @ValidateIf((dto) => Boolean(dto.playerThreeName?.trim()))
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  playerThreeHasCommercialAgreement?: boolean;

  @ValidateIf((dto) => Boolean(dto.playerThreeName?.trim()) && dto.playerThreeHasCommercialAgreement)
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  playerThreeCommercialAgreementDetails?: string;
}
