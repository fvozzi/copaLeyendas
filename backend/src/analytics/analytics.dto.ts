import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class RecordPageViewDto {
  @IsString()
  @MaxLength(300)
  @Matches(/^\/(?!app(?:\/|$))/)
  path: string;

  @IsUUID()
  visitorId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;
}
