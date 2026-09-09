import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SendTemplateMessageDto {
  @IsString()
  @Matches(/^[+\d][\d\s()-]{7,24}$/, { message: 'El telefono no tiene un formato valido' })
  to: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  templateName: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2,3}_[A-Z]{2}$/)
  languageCode?: string;
}
