import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SendTextMessageDto {
  @IsString()
  @Matches(/^[+\d][\d\s()-]{7,24}$/, { message: 'El telefono no tiene un formato valido' })
  to: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  message: string;

  @IsOptional()
  @IsBoolean()
  previewUrl?: boolean;
}
