import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RegistrationStatus } from '../registration.enums';

export class UpdateRegistrationStatusDto {
  @IsEnum(RegistrationStatus)
  status: RegistrationStatus;

  @IsOptional()
  @IsBoolean()
  feeWaived?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  adminNotes?: string;
}
