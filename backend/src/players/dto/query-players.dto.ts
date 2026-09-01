import { IsOptional, IsString } from 'class-validator';

export class QueryPlayersDto {
  @IsOptional()
  @IsString()
  search?: string;
}
