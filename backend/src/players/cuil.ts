import { BadRequestException } from '@nestjs/common';

export function normalizeAndValidateCuil(value: string, dni: string) {
  const cuil = value.replace(/\D/g, '');
  const normalizedDni = dni.replace(/\D/g, '').padStart(8, '0');
  if (cuil.length !== 11) throw new BadRequestException('El CUIL debe tener 11 digitos');
  if (cuil.slice(2, 10) !== normalizedDni) {
    throw new BadRequestException('El DNI incluido en el CUIL no coincide con la jugadora');
  }
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(cuil[index]) * weight, 0);
  const remainder = 11 - (sum % 11);
  const verifier = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;
  if (Number(cuil[10]) !== verifier) throw new BadRequestException('El digito verificador del CUIL no es valido');
  return cuil;
}

export function formatCuil(value: string | null) {
  return value ? `${value.slice(0, 2)}-${value.slice(2, 10)}-${value.slice(10)}` : '';
}

export function cuilMatchesDni(value: string | null, dni: string) {
  if (!value) return false;
  try {
    normalizeAndValidateCuil(value, dni);
    return true;
  } catch {
    return false;
  }
}
