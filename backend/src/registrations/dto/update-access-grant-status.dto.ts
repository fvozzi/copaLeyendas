import { IsEnum } from 'class-validator';
import { RegistrationAccessGrantStatus } from '../registration.enums';

export class UpdateAccessGrantStatusDto {
  @IsEnum(RegistrationAccessGrantStatus)
  status: RegistrationAccessGrantStatus;
}
