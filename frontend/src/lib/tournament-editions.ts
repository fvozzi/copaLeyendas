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

export interface TournamentEdition {
  slug: string;
  name: string;
  shortName: string;
  year: number;
  dateLabel: string;
  legendName: string;
  legendSearchTerms: string[];
  summary: string;
  status: TournamentEditionStatus;
  specialEdition?: boolean;
  usesLiveTournament?: boolean;
  photos: TournamentPhoto[];
  finals: TournamentFinal[];
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
    legendName: 'Aarón “Quique” Setter',
    legendSearchTerms: ['aaron', 'quique', 'setter'],
    summary: 'La segunda edición de la Copa Leyendas, con seis finales disputadas.',
    status: 'finished',
    photos: [
      { src: '/torneos/2026/fotos/foto-01.webp', alt: 'Delegación participante de la Copa Leyendas 2026' },
      { src: '/torneos/2026/fotos/foto-02.webp', alt: 'Foto general de participantes de la Copa Leyendas 2026' },
      { src: '/torneos/2026/fotos/foto-03.webp', alt: 'Parejas participantes de la edición 2026' },
      { src: '/torneos/2026/fotos/foto-04.webp', alt: 'Jugadores de la Copa Leyendas 2026 en cancha' },
      { src: '/torneos/2026/fotos/foto-05.webp', alt: 'Participantes durante la jornada de 2026' },
      { src: '/torneos/2026/fotos/foto-06.webp', alt: 'Equipos de la Copa Leyendas 2026' },
      { src: '/torneos/2026/fotos/foto-07.webp', alt: 'Delegación reunida al finalizar sus partidos' },
      { src: '/torneos/2026/fotos/foto-08.webp', alt: 'Equipo en una de las canchas de la edición 2026' },
      { src: '/torneos/2026/fotos/foto-09.webp', alt: 'Participantes reunidos en el trinquete' },
      { src: '/torneos/2026/fotos/foto-10.webp', alt: 'Jugadores premiados en la Copa Leyendas 2026' },
      { src: '/torneos/2026/fotos/foto-11.webp', alt: 'Partido de la Copa Leyendas 2026' },
      { src: '/torneos/2026/fotos/foto-12.webp', alt: 'Pelota paleta en juego durante la edición 2026' },
    ],
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
    summary: 'La primera edición de la Copa Leyendas y el comienzo de este archivo.',
    status: 'finished',
    photos: [
      { src: '/torneos/2025/fotos/foto-01.webp', alt: 'Detalle de la camiseta de Copa Leyendas 2025' },
      { src: '/torneos/2025/fotos/foto-02.webp', alt: 'Festejo de la Copa Leyendas 2025' },
      { src: '/torneos/2025/fotos/foto-03.webp', alt: 'Premios y presentes preparados para la edición 2025' },
      { src: '/torneos/2025/fotos/foto-04.webp', alt: 'Participantes en una de las sedes de la Copa Leyendas 2025' },
      { src: '/torneos/2025/fotos/foto-05.webp', alt: 'Encuentro entre jugadores durante la edición 2025' },
      { src: '/torneos/2025/fotos/foto-06.webp', alt: 'Parejas al finalizar una jornada de la Copa Leyendas 2025' },
      { src: '/torneos/2025/fotos/foto-07.webp', alt: 'Participantes de la edición 2025 en cancha' },
      { src: '/torneos/2025/fotos/foto-08.webp', alt: 'Partido de la Copa Leyendas 2025' },
      { src: '/torneos/2025/fotos/foto-09.webp', alt: 'Equipo organizador y participantes de la edición 2025' },
      { src: '/torneos/2025/fotos/foto-10.webp', alt: 'Público y participantes de la Copa Leyendas 2025' },
      { src: '/torneos/2025/fotos/foto-11.webp', alt: 'Encuentro de camaradería de la edición 2025' },
      { src: '/torneos/2025/fotos/foto-12.webp', alt: 'Premiación de la Copa Leyendas 2025' },
    ],
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
