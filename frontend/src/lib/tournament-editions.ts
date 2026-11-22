export type TournamentEditionStatus = 'finished' | 'upcoming';

export interface Finalist {
  locality: string;
  players: string;
}

export interface TournamentFinal {
  category: string;
  champion: Finalist;
  finalist: Finalist;
}

export interface TournamentPhoto {
  src: string;
  alt: string;
}

export interface TournamentLegendContent {
  title: string;
  paragraphs: string[];
  image?: TournamentPhoto;
  interview?: {
    label: string;
    url: string;
    embedUrl: string;
  };
}

export interface TournamentEdition {
  slug: string;
  name: string;
  shortName: string;
  year: number;
  dateLabel: string;
  legendName: string;
  legendSearchTerms: string[];
  legendContent: TournamentLegendContent;
  summary: string;
  status: TournamentEditionStatus;
  specialEdition?: boolean;
  usesLiveTournament?: boolean;
  photos: TournamentPhoto[];
  finals: TournamentFinal[];
}

export const tournamentArchiveStory = {
  title: 'Donde la historia sigue viva',
  paragraphs: [
    'La Copa Leyendas nace en marzo de 2025 con un propósito que va mucho más allá de la competencia: rendir homenaje a quienes, con su talento, pasión y entrega, escribieron las páginas más memorables de la historia de nuestro deporte.',
    'Porque las leyendas no se miden solamente por los títulos conquistados o las hazañas dentro de la cancha, sino también por la huella que dejan, los valores que representan y la inspiración que transmiten.',
    'Cada leyenda es una historia de esfuerzo, sacrificio y amor por la pelota. Un legado que trasciende generaciones y que merece seguir vivo.',
    'La Copa Leyendas es encuentro, homenaje y reconocimiento. Es reunir a quienes hicieron grande nuestro deporte con las nuevas generaciones, compartir experiencias, transmitir valores e inspirar a quienes hoy comienzan a escribir su propia historia.',
    'Porque las verdaderas leyendas nunca dejan de jugar: siguen vivas en su legado y en cada nueva generación que mantiene encendida la pasión por nuestro deporte.',
  ],
};

function createTournamentPhotos(year: number, count: number): TournamentPhoto[] {
  return Array.from({ length: count }, (_, index) => {
    const photoNumber = index + 1;
    return {
      src: `/torneos/${year}/fotos/foto-${String(photoNumber).padStart(2, '0')}.webp`,
      alt: `Foto ${photoNumber} de la Copa Leyendas ${year}`,
    };
  });
}

export const tournamentEditions: TournamentEdition[] = [
  {
    slug: 'femme-2026',
    name: 'Copa Leyendas Femme 2026',
    shortName: 'Femme 2026',
    year: 2026,
    dateLabel: 'Noviembre 2026',
    legendName: 'Silvina Cimadamore',
    legendSearchTerms: ['silvina', 'cimadamore'],
    legendContent: {
      title: 'Silvina Cimadamore',
      paragraphs: [
        'En esta edición especial “Femme”, le rendimos homenaje a Silvina Cimadamore, una verdadera pionera de la Pelota a Paleta femenina en la Argentina. Su trayectoria abrió el camino para que muchas mujeres encontraran su lugar en este deporte, convirtiéndose en un ejemplo de compromiso, perseverancia y pasión.',
        'Gracias a pioneras como Silvina, la Pelota a Paleta femenina creció, amplió sus horizontes y sigue construyendo su futuro sobre las bases que ellas ayudaron a forjar.',
      ],
      image: {
        src: '/torneos/femme-2026/silvina-cimadamore.webp',
        alt: 'Póster de la Copa Leyendas Femme 2026 en homenaje a Silvina Cimadamore',
      },
      interview: {
        label: 'Ver entrevista a Silvina Cimadamore',
        url: 'https://www.youtube.com/watch?v=3GmOVfJMYR0&list=PLIrYhifQfct3CIuNXUsD_JDbSO6AGcHmk&index=13',
        embedUrl: 'https://www.youtube-nocookie.com/embed/3GmOVfJMYR0',
      },
    },
    summary: 'Una edición especial y única dedicada íntegramente a las mujeres.',
    status: 'upcoming',
    specialEdition: true,
    usesLiveTournament: true,
    photos: [],
    finals: [],
  },
  {
    slug: '2026',
    name: 'Copa Leyendas 2026',
    shortName: 'Edición 2026',
    year: 2026,
    dateLabel: '2026',
    legendName: 'Aarón “Quique” Sehter',
    legendSearchTerms: ['aaron', 'quique', 'sehter'],
    legendContent: {
      title: 'Aarón “Quique” Sehter',
      paragraphs: [
        'Delantero en frontón y zaguero en trinquete, nació el 11 de enero de 1934 en la Ciudad de Buenos Aires. Empezó a jugar de muy joven y a los 16 años inició su carrera deportiva en primera categoría. Obtuvo 9 campeonatos metropolitanos, 7 campeonatos argentinos, 7 medallas de oro en rioplatenses, 7 medallas de oro en sudamericanos y 13 medallas de oro en mundiales, además de ganar una extensa cantidad de torneos. Fue testigo privilegiado al participar del primer campeonato mundial de pelota vasca, realizado en 1952. Además, conoció y jugó partidos junto a los más grandes pelotaris de nuestra historia.',
      ],
      interview: {
        label: 'Ver entrevista a Quique Sehter',
        url: 'https://www.youtube.com/watch?v=mS0TVfKJn0I&t=17s',
        embedUrl: 'https://www.youtube-nocookie.com/embed/mS0TVfKJn0I?start=17',
      },
    },
    summary: 'La segunda edición de la Copa Leyendas, con seis finales disputadas.',
    status: 'finished',
    photos: createTournamentPhotos(2026, 63),
    finals: [
      { category: '5ta', champion: { locality: 'Rufino', players: 'Salussu · Fernández · Gravino' }, finalist: { locality: 'Santa Regina', players: 'Blangetti · Rossi' } },
      { category: '4ta', champion: { locality: 'Chacabuco', players: 'Triunfo · Albornoz' }, finalist: { locality: 'San A. de Giles', players: 'Pedretti · Pedretti' } },
      { category: '3ra', champion: { locality: 'Montevideo', players: 'Urretavizcaya · De Luca' }, finalist: { locality: 'Fuerza Aérea', players: 'Andreasen · Andreasen' } },
      { category: '2da', champion: { locality: 'Corrientes', players: 'Pezzarini · Pezzarini' }, finalist: { locality: 'Ramallo', players: 'Ross · Pelaez' } },
      { category: '1ra', champion: { locality: 'Venado Tuerto', players: 'Algarbe · Cedres' }, finalist: { locality: 'Chascomús', players: 'Gonzalia · Leclerq' } },
      { category: 'Sehter', champion: { locality: 'San Luis', players: 'Miranda · Berruezo (Thoss)' }, finalist: { locality: 'Concepción del Uruguay', players: 'Cardozo · Gatter' } },
    ],
  },
  {
    slug: '2025',
    name: 'Copa Leyendas 2025',
    shortName: 'Edición 2025',
    year: 2025,
    dateLabel: '2025',
    legendName: 'Rodolfo “Titi” Bazán',
    legendSearchTerms: ['rodolfo', 'titi', 'bazan'],
    legendContent: {
      title: 'Rodolfo “Titi” Bazán',
      paragraphs: [
        'Zaguero en trinquete y frontón, nació el 17 de diciembre de 1949 en la Ciudad de Buenos Aires. Motivado por su padre, comenzó a jugar a los 7 años en el club Balcarce de Vicente López y a los 11 años inició su carrera en el Club Ciudad de Buenos Aires. Obtuvo 2 campeonatos metropolitanos, 3 campeonatos argentinos y 2 medallas de oro en campeonatos mundiales. Retirado hace varias décadas de las competencias oficiales, continúa jugando en distintos clubes y disfrutando junto a las nuevas generaciones de pelotaris.',
      ],
      interview: {
        label: 'Ver entrevista a Titi Bazán',
        url: 'https://www.youtube.com/watch?v=WA8mIbbOJzs&t=114s',
        embedUrl: 'https://www.youtube-nocookie.com/embed/WA8mIbbOJzs?start=114',
      },
    },
    summary: 'La primera edición de la Copa Leyendas y el comienzo de este archivo.',
    status: 'finished',
    photos: createTournamentPhotos(2025, 133),
    finals: [
      { category: '4ta', champion: { locality: 'Chacabuco', players: 'Miori · Cabalieri' }, finalist: { locality: 'Allende', players: 'Broito · Vazquez' } },
      { category: '3ra', champion: { locality: 'Urquiza', players: 'Córdoba · Leiva' }, finalist: { locality: 'Campana', players: 'Fahler · Olivero · Ditullio' } },
      { category: '2da', champion: { locality: 'Gesell', players: 'Zanotti · Debiassi' }, finalist: { locality: 'Choele', players: 'Regueira · Suarez' } },
      { category: 'Damas', champion: { locality: 'Plottier', players: 'Riquelme · Riquelme' }, finalist: { locality: 'Allende', players: 'Cano · Cava' } },
      { category: '1ra', champion: { locality: 'San Martín', players: 'Villegas · Suarez' }, finalist: { locality: 'Ramallo', players: 'Miranda · Cid' } },
    ],
  },
];

export function getTournamentEdition(slug: string | undefined) {
  return tournamentEditions.find((edition) => edition.slug === slug);
}

export function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}
