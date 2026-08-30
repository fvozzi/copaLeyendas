import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PairCategory, RegistrationStatus } from '../registration.enums';

export class QueryRegistrationsDto {
  @IsOptional()
  @IsEnum(PairCategory)
  category?: PairCategory;

  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
