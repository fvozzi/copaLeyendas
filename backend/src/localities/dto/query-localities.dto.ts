import { IsOptional, IsString } from 'class-validator';

export class QueryLocalitiesDto {
  @IsOptional()
  @IsString()
  search?: string;
}
