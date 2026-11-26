import type { CommunityCourt, CommunityCourtColor, CommunityCourtOrganizationType, CommunityCourtPlayerGroup, CommunityCourtType, CommunityFrontisFinish, CommunityPlayerGender, FrontonBackType, FrontonTambur, FrontonWallOrientation, TrinquetShareMaterial } from '../types';

export const southAmericanCountries = [
  { code: 'ar', name: 'Argentina' }, { code: 'bo', name: 'Bolivia' }, { code: 'br', name: 'Brasil' },
  { code: 'cl', name: 'Chile' }, { code: 'co', name: 'Colombia' }, { code: 'ec', name: 'Ecuador' },
  { code: 'gf', name: 'Guayana Francesa' }, { code: 'gy', name: 'Guyana' }, { code: 'py', name: 'Paraguay' },
  { code: 'pe', name: 'Perú' }, { code: 'sr', name: 'Surinam' }, { code: 'uy', name: 'Uruguay' },
  { code: 've', name: 'Venezuela' },
] as const;

export const communityGenderLabels: Record<CommunityPlayerGender, string> = {
  FEMALE: 'Mujeres', MALE: 'Varones', MIXED: 'Mixto', OTHER: 'Otro / sin especificar',
};

export const communityCourtTypeLabels: Record<CommunityCourtType, string> = { TRINQUET: 'Trinquete', FRONTON: 'Frontón' };
export const communityCourtOrganizationLabels: Record<CommunityCourtOrganizationType, string> = {
  CLUB: 'Club', ASSOCIATION: 'Asociación', PRIVATE_ESTABLISHMENT: 'Establecimiento privado', EDUCATIONAL_INSTITUTION: 'Institución educativa',
  MUNICIPAL_PUBLIC: 'Municipio / espacio público', UNION_MUTUAL: 'Sindicato / mutual', NEIGHBORHOOD_CENTER: 'Sociedad de fomento / centro vecinal', OTHER: 'Otro',
};
export const frontisFinishLabels: Record<CommunityFrontisFinish, string> = { HARD: 'Duro', MARBLE: 'Mármol' };
export const courtColorLabels: Record<CommunityCourtColor, string> = { WHITE: 'Blanca', BLUE: 'Azul', GREEN: 'Verde', GRAY: 'Gris' };
export const shareMaterialLabels: Record<TrinquetShareMaterial, string> = { WOOD: 'Madera', MASONRY: 'Material / mampostería', OTHER: 'Otro' };
export const frontonWallLabels: Record<FrontonWallOrientation, string> = { LEFT_LONG: 'Pared izquierda larga y derecha corta', RIGHT_LONG: 'Pared derecha larga e izquierda corta' };
export const frontonTamburLabels: Record<FrontonTambur, string> = { LEFT: 'Tambur izquierda', RIGHT: 'Tambur derecha', BOTH: 'Tambur izquierda y derecha', NONE: 'Sin tambur' };
export const frontonBackLabels: Record<FrontonBackType, string> = { REBOUND: 'Con rebote', FREE_LIFT: 'Levante libre' };

export function courtFeatureLabels(court: CommunityCourt) {
  const commonFeatures = [
    `Frontón: ${court.frontisFinish ? frontisFinishLabels[court.frontisFinish] : 'Sin informar'}`,
    `Color: ${court.courtColor ? courtColorLabels[court.courtColor] : 'Sin informar'}`,
    court.inaugurationDate ? `Inaugurada: ${formatCourtDate(court.inaugurationDate)}` : 'Fecha de inauguración sin informar',
    court.hasSchool ? 'Con escuelita' : 'Sin escuelita',
  ];
  if (court.courtType === 'TRINQUET') return [
    ...commonFeatures,
    `Share: ${court.trinquetShareMaterial === 'OTHER' ? court.trinquetShareMaterialOther || 'Otro material' : court.trinquetShareMaterial ? shareMaterialLabels[court.trinquetShareMaterial] : 'Sin informar'}`,
  ];
  if (court.courtType === 'FRONTON') return [
    ...commonFeatures,
    court.frontonWallOrientation ? frontonWallLabels[court.frontonWallOrientation] : 'Orientación de paredes sin informar',
    court.frontonTambur ? frontonTamburLabels[court.frontonTambur] : 'Tambur sin informar',
    court.frontonHasCacerola ? 'Con cacerola' : 'Sin cacerola',
    court.frontonBackType === 'REBOUND' ? `Rebote: ${court.frontonReboundMaterial || 'material sin informar'}` : court.frontonBackType ? frontonBackLabels[court.frontonBackType] : 'Fondo sin informar',
  ];
  return [...commonFeatures, 'Tipo de cancha sin informar'];
}

function formatCourtDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR').format(new Date(year, month - 1, day));
}

export function ageRangeLabel(group: Pick<CommunityCourtPlayerGroup, 'minAge' | 'maxAge'>) {
  if (group.minAge === null && group.maxAge === null) return 'Todas las edades';
  if (group.minAge === null) return `Hasta ${group.maxAge} años`;
  if (group.maxAge === null) return `Desde ${group.minAge} años`;
  if (group.minAge === group.maxAge) return `${group.minAge} años`;
  return `${group.minAge} a ${group.maxAge} años`;
}
