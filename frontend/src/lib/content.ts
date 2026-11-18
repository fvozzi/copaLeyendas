import type {
  AccessGrantStatus,
  ContentSection,
  HeardAboutSource,
  RegistrationStatus,
  ShirtModel,
  ShirtSize,
} from '../types';

export const sectionMeta: Record<
  ContentSection,
  {
    label: string;
    intro: string;
  }
> = {
  leyendas: {
    label: 'Leyendas',
    intro: 'Jugadoras, referentes y nombres que hicieron historia en la pelota paleta.',
  },
  canchas: {
    label: 'Sedes',
    intro: 'Direcciones y datos para llegar a cada sede del torneo.',
  },
  torneos: {
    label: 'Torneos',
    intro: 'Ediciones y próximos torneos.',
  },
  historias: {
    label: 'Historias',
    intro: 'Crónicas, archivo y relatos del recorrido cultural de la paleta.',
  },
};

export const publicSectionKeys: ContentSection[] = ['canchas', 'torneos', 'historias'];

export const registrationStatusLabels: Record<RegistrationStatus, string> = {
  RECEIVED: 'Recibida',
  UNDER_REVIEW: 'En revision',
  CONFIRMED: 'Confirmada',
  WAITLIST: 'Lista de espera',
  REJECTED: 'Rechazada',
};

export const accessGrantStatusLabels: Record<AccessGrantStatus, string> = {
  ACTIVE: 'Activo',
  USED: 'Usado',
  REVOKED: 'Revocado',
};

export const heardAboutLabels: Record<HeardAboutSource, string> = {
  INSTAGRAM: 'Instagram',
  FRIEND: 'Amigo/a',
  CLUB: 'Por medio del Club',
  OTHER: 'Otro',
};

export const shirtSizeLabels: ShirtSize[] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', 'XXXXXL'];
export const shirtModelLabels: ShirtModel[] = ['Guastavino Color 1', 'Guastavino Color 2', 'Dabber Color 3', 'Dabber Color 4'];

export const tournamentHighlights = [
  'Edicion de noviembre dedicada a Damas',
  'Mas de 100 pelotaris convocadas',
  '9 canchas activas en paralelo en Buenos Aires',
  'Proyeccion federal con localidades de todo el pais',
];

export const tournamentStory = {
  title: 'Copa Leyendas de Paleta',
  subtitle:
    'Un torneo federal que cruza memoria, competencia y comunidad en una sola plataforma.',
  description:
    'Copa Leyendas Femme Edición "Silvina Cimadamore".',
  schedule: 'Noviembre 2026',
  place: 'Ciudad de Buenos Aires',
  instagramUrl: 'https://www.instagram.com/copa.leyendas.pelotapaleta/',
};
