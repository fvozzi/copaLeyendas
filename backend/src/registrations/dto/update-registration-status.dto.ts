import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RegistrationStatus } from '../registration.enums';

export class UpdateRegistrationStatusDto {
  @IsEnum(RegistrationStatus)
  status: RegistrationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  adminNotes?: string;
}
