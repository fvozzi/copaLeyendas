export type ContentSection = 'leyendas' | 'canchas' | 'torneos' | 'historias';

export type PairCategory =
  | 'DAMAS_A'
  | 'DAMAS_B'
  | 'DAMAS_NUCLEO_A'
  | 'DAMAS_NUCLEO_B';

export type RegistrationStatus =
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'CONFIRMED'
  | 'WAITLIST'
  | 'REJECTED';

export type AccessGrantStatus = 'ACTIVE' | 'USED' | 'REVOKED';

export type HeardAboutSource = 'INSTAGRAM' | 'FRIEND' | 'CLUB' | 'OTHER';

export type ShirtSize = 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL' | 'XXXXL' | 'XXXXXL';

export type UserRole = 'DIRECTOR' | 'ASSISTANT' | 'EDITOR';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserPayload {
  name: string;
  email: string;
  password?: string;
  role: 'DIRECTOR' | 'ASSISTANT';
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ContentPost {
  id: number;
  section: ContentSection;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  published: boolean;
  featured: boolean;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  posts: {
    total: number;
    published: number;
    featured: number;
    bySection: Record<string, number>;
  };
  registrations: {
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  };
  accessGrants: {
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export interface RegistrationAccessGrant {
  id: number;
  token: string;
  category: PairCategory;
  localityName: string;
  provinceName: string;
  clubName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  feeWaived: boolean;
  paymentDeferredUntilConfirmed: boolean;
  status: AccessGrantStatus;
  consumedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAccessGrant {
  id: number;
  token: string;
  category: PairCategory;
  localityName: string;
  provinceName: string;
  clubName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  feeWaived: boolean;
  paymentDeferredUntilConfirmed: boolean;
  status: AccessGrantStatus;
  enabled: boolean;
}

export interface PairRegistration {
  id: number;
  accessGrantId: number;
  category: PairCategory;
  localityName: string;
  provinceName: string;
  clubName: string;
  heardAboutSource: HeardAboutSource;
  heardAboutOtherText: string | null;
  tournamentAvailabilityConfirmed: boolean;
  representingText: string;
  contactEmail: string | null;
  feeWaived: boolean;
  paymentDeferredUntilConfirmed: boolean;
  playerOneName: string;
  playerOneDni: string;
  playerOneBirthDate: string;
  playerOnePhone: string;
  playerOneInstagram: string | null;
  playerOneShirtSize: ShirtSize;
  playerOneHasCommercialAgreement: boolean;
  playerOneCommercialAgreementDetails: string | null;
  playerTwoName: string;
  playerTwoDni: string;
  playerTwoBirthDate: string;
  playerTwoPhone: string;
  playerTwoInstagram: string | null;
  playerTwoShirtSize: ShirtSize;
  playerTwoHasCommercialAgreement: boolean;
  playerTwoCommercialAgreementDetails: string | null;
  playerThreeName: string | null;
  playerThreeDni: string | null;
  playerThreeBirthDate: string | null;
  playerThreePhone: string | null;
  playerThreeInstagram: string | null;
  playerThreeShirtSize: ShirtSize | null;
  playerThreeHasCommercialAgreement: boolean;
  playerThreeCommercialAgreementDetails: string | null;
  paymentProofStoredName: string | null;
  paymentProofOriginalName: string | null;
  paymentProofMimeType: string | null;
  paymentProofSizeBytes: number | null;
  status: RegistrationStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicRegistrationPayload {
  accessToken: string;
  heardAboutSource: HeardAboutSource;
  heardAboutOtherText?: string;
  tournamentAvailabilityConfirmed: boolean;
  representingText: string;
  contactEmail?: string;
  playerOneName: string;
  playerOneDni: string;
  playerOneBirthDate: string;
  playerOnePhone: string;
  playerOneInstagram?: string;
  playerOneShirtSize: ShirtSize;
  playerOneHasCommercialAgreement: boolean;
  playerOneCommercialAgreementDetails?: string;
  playerTwoName: string;
  playerTwoDni: string;
  playerTwoBirthDate: string;
  playerTwoPhone: string;
  playerTwoInstagram?: string;
  playerTwoShirtSize: ShirtSize;
  playerTwoHasCommercialAgreement: boolean;
  playerTwoCommercialAgreementDetails?: string;
  playerThreeName?: string;
  playerThreeDni?: string;
  playerThreeBirthDate?: string;
  playerThreePhone?: string;
  playerThreeInstagram?: string;
  playerThreeShirtSize?: ShirtSize;
  playerThreeHasCommercialAgreement?: boolean;
  playerThreeCommercialAgreementDetails?: string;
  paymentProof?: File;
  playerOnePhoto?: File;
  playerTwoPhoto?: File;
  playerThreePhoto?: File;
}

export interface PublicRegistrationResponse {
  id: number;
  status: RegistrationStatus;
  message: string;
}

export interface PostPayload {
  section: ContentSection;
  title: string;
  slug?: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string;
  published?: boolean;
  featured?: boolean;
  sortOrder?: number;
}

export interface RegistrationStatusPayload {
  status: RegistrationStatus;
  adminNotes?: string;
}

export interface AccessGrantPayload {
  localityId?: number;
  category: PairCategory;
  localityName: string;
  provinceName: string;
  clubName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  feeWaived?: boolean;
  paymentDeferredUntilConfirmed?: boolean;
}

export interface AccessGrantStatusPayload {
  status: AccessGrantStatus;
}

export interface Locality {
  id: number;
  name: string;
  provinceName: string;
  active: boolean;
  categoryId: number | null;
  category: Category | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalityPayload {
  name: string;
  provinceName: string;
  active?: boolean;
  categoryId?: number | null;
}

export interface Category { id: number; code: PairCategory; name: string; active: boolean; sortOrder: number; }
export interface CategoryPayload { code: PairCategory; name: string; active?: boolean; sortOrder?: number; }
export interface CourtAssistant { id: number; name: string; email: string; }
export interface Court { id: number; name: string; address: string | null; city: string | null; provinceName: string | null; active: boolean; assistantIds: number[]; assistants: CourtAssistant[]; }
export interface CourtPayload { name: string; address?: string; city?: string; provinceName?: string; active?: boolean; }

export interface Tournament { id: number; name: string; startsAt: string | null; endsAt: string | null; city: string | null; status: 'DRAFT' | 'ACTIVE' | 'COMPLETED'; }
export interface TournamentPayload { name: string; startsAt?: string; endsAt?: string; city?: string; status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED'; }
export interface TournamentCategory { id: number; categoryId: number; pointsPerSet: number; setsToWin: number; zoneSize: number; category: Category; }
export interface TournamentZone { id: number; name: string; capacity: number; tournamentCategoryId: number; court: Court; tournamentCategory: TournamentCategory; }
export interface TournamentDetail extends Tournament { categories: TournamentCategory[]; zones: TournamentZone[]; }
export interface TournamentMatch { id: number; matchOrder: number; status: string; homeRegistration: PairRegistration | null; awayRegistration: PairRegistration | null; homeScore: number | null; awayScore: number | null; scheduledAt: string | null; }
export interface ZoneEntry { id: number; registration: PairRegistration; }
export interface ZoneDetail extends TournamentZone { entries: ZoneEntry[]; }
export interface PublicStanding { registration: PairRegistration; played: number; wins: number; losses: number; pointsFor: number; pointsAgainst: number; tablePoints: number; }
export interface PublicTournamentZone { id: number; name: string; category: string; court: Court; standings: PublicStanding[]; matches: TournamentMatch[]; }
export interface PublicTournament extends Tournament { zones: PublicTournamentZone[]; }
export interface PublicCurrentTournament { tournament: PublicTournament | null; courts: Court[]; }

export interface Player {
  id: number;
  fullName: string;
  dni: string;
  birthDate: string | null;
  phone: string | null;
  instagram: string | null;
  shirtSize: ShirtSize | null;
  localityId: number | null;
  locality: Locality | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerPayload {
  fullName: string;
  dni: string;
  birthDate?: string;
  phone?: string;
  instagram?: string;
  shirtSize?: ShirtSize | '';
  localityId?: number | null;
}

export interface CashIncome {
  id: number;
  team: string;
  players: number;
  amount: number;
  paidAt: string;
}

export interface CashExpense {
  id: number;
  reason: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdAt: string;
}

export interface CashSummary {
  feePerPlayer: number;
  incomes: CashIncome[];
  expenses: CashExpense[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
}
