import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { RegistrationAccessGrantStatus } from '../registration.enums';

export class QueryAccessGrantsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsEnum(RegistrationAccessGrantStatus)
  status?: RegistrationAccessGrantStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
