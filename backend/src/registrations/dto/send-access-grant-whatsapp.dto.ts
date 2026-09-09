import { IsUrl, MaxLength } from 'class-validator';

export class SendAccessGrantWhatsAppDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false, disallow_auth: true })
  @MaxLength(2048)
  siteUrl: string;
}
