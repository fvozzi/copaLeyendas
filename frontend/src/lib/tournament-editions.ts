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
    photos: [],
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
    photos: [],
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
