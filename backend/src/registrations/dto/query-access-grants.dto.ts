import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PairCategory, RegistrationAccessGrantStatus } from '../registration.enums';

export class QueryAccessGrantsDto {
  @IsOptional()
  @IsEnum(PairCategory)
  category?: PairCategory;

  @IsOptional()
  @IsEnum(RegistrationAccessGrantStatus)
  status?: RegistrationAccessGrantStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
