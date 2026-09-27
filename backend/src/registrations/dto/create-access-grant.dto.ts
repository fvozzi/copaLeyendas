import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

function toBoolean(value: unknown) {
  return value === true || value === 'true' || value === 'on';
}

export class CreateAccessGrantDto {
  @Type(() => Number)
  @IsInt()
  localityId: number;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar el nombre del contacto' })
  @MaxLength(140)
  contactName: string;

  @Transform(({ value }) => typeof value === 'string' && value.trim() ? value.trim() : undefined)
  @IsOptional()
  @IsEmail({}, { message: 'El email de contacto debe ser valido' })
  contactEmail?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar el numero de WhatsApp' })
  @Matches(/^\+?[0-9 ()-]{8,40}$/, {
    message: 'El numero de WhatsApp debe incluir solo numeros y el codigo de pais',
  })
  @MaxLength(40)
  contactPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  feeWaived?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  paymentDeferredUntilConfirmed?: boolean;
}
