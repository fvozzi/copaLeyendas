import type {
  AccessGrantStatus,
  ContentSection,
  HeardAboutSource,
  PairCategory,
  RegistrationStatus,
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
    label: 'Canchas',
    intro: 'Sedes, trinquetes y datos operativos para vivir el torneo en Buenos Aires.',
  },
  torneos: {
    label: 'Torneos',
    intro: 'Fechas, convocatorias y torneos aliados que alimentan el calendario federal.',
  },
  historias: {
    label: 'Historias',
    intro: 'Cronicas, archivo y relatos del recorrido cultural de la paleta.',
  },
};

export const categoryLabels: Record<PairCategory, string> = {
  DAMAS_A: 'Damas A',
  DAMAS_B: 'Damas B',
  DAMAS_NUCLEO_A: 'Damas Nucleo A',
  DAMAS_NUCLEO_B: 'Damas Nucleo B',
};

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
    'La edicion actual concentra el circuito de Damas y deja lista una base digital para crecer luego hacia el torneo general con nuevas categorias, archivo historico y difusion anual.',
  schedule: 'Noviembre 2026',
  place: 'Ciudad de Buenos Aires',
  instagramUrl: 'https://www.instagram.com/copa.leyendas.pelotapaleta/',
};
