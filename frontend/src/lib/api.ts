import type {
  AccessGrantPayload,
  AccessGrantStatusPayload,
  DashboardSummary,
  LoginResponse,
  PairRegistration,
  PostPayload,
  PublicAccessGrant,
  PublicRegistrationPayload,
  PublicRegistrationResponse,
  RegistrationAccessGrant,
  RegistrationStatusPayload,
  ContentPost,
  Locality,
  LocalityPayload,
  Player,
  PlayerPayload,
  Category, CategoryPayload, Court, CourtPayload,
  Tournament, TournamentPayload, TournamentDetail, TournamentMatch, ZoneDetail, AdminUser, AdminUserPayload,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const TOKEN_KEY = 'copa_leyendas_token';
const USER_KEY = 'copa_leyendas_user';

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function storeSession(payload: LoginResponse) {
  window.localStorage.setItem(TOKEN_KEY, payload.accessToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

function buildQuery(params: Record<string, string | boolean | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function readError(response: Response) {
  const body = await response.text();

  if (!body.trim()) {
    return 'Request failed';
  }

  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join('\n');
    }
    return parsed.message ?? body;
  } catch {
    return body;
  }
}

async function request<T>(path: string, init: RequestInit = {}, requireAuth = false): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};

  if (init.body && !(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (requireAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && requireAuth) {
      clearSession();
    }

    throw new Error(await readError(response));
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export function login(email: string, password: string) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getCurrentUser() {
  return request<LoginResponse['user']>('/auth/me', {}, true);
}

export function getUsers() { return request<AdminUser[]>('/users', {}, true); }
export function createUser(payload: AdminUserPayload) { return request<AdminUser>('/users', { method: 'POST', body: JSON.stringify(payload) }, true); }
export function updateUser(id: number, payload: AdminUserPayload) { return request<AdminUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, true); }
export function deleteUser(id: number) { return request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' }, true); }

export function getPublicPosts(params?: { section?: string; featured?: boolean }) {
  return request<ContentPost[]>(
    `/public/posts${buildQuery({
      section: params?.section,
      featured: params?.featured,
    })}`,
  );
}

export function getPublicPostBySlug(slug: string) {
  return request<ContentPost>(`/public/posts/${slug}`);
}

export function getPublicRegistrationAccess(token: string) {
  return request<PublicAccessGrant>(`/public/registrations/access/${encodeURIComponent(token)}`);
}

export function createPublicRegistration(payload: PublicRegistrationPayload) {
  const formData = new FormData();
  formData.set('accessToken', payload.accessToken);
  formData.set('heardAboutSource', payload.heardAboutSource);
  if (payload.heardAboutOtherText) {
    formData.set('heardAboutOtherText', payload.heardAboutOtherText);
  }
  formData.set('tournamentAvailabilityConfirmed', String(payload.tournamentAvailabilityConfirmed));
  formData.set('representingText', payload.representingText);
  if (payload.contactEmail) {
    formData.set('contactEmail', payload.contactEmail);
  }
  formData.set('playerOneName', payload.playerOneName);
  formData.set('playerOneDni', payload.playerOneDni);
  formData.set('playerOneBirthDate', payload.playerOneBirthDate);
  formData.set('playerOnePhone', payload.playerOnePhone);
  if (payload.playerOneInstagram) {
    formData.set('playerOneInstagram', payload.playerOneInstagram);
  }
  formData.set('playerOneShirtSize', payload.playerOneShirtSize);
  formData.set('playerTwoName', payload.playerTwoName);
  formData.set('playerTwoDni', payload.playerTwoDni);
  formData.set('playerTwoBirthDate', payload.playerTwoBirthDate);
  formData.set('playerTwoPhone', payload.playerTwoPhone);
  if (payload.playerTwoInstagram) {
    formData.set('playerTwoInstagram', payload.playerTwoInstagram);
  }
  formData.set('playerTwoShirtSize', payload.playerTwoShirtSize);
  if (payload.playerThreeName) {
    formData.set('playerThreeName', payload.playerThreeName);
  }
  if (payload.playerThreeDni) {
    formData.set('playerThreeDni', payload.playerThreeDni);
  }
  if (payload.playerThreeBirthDate) {
    formData.set('playerThreeBirthDate', payload.playerThreeBirthDate);
  }
  if (payload.playerThreePhone) {
    formData.set('playerThreePhone', payload.playerThreePhone);
  }
  if (payload.playerThreeInstagram) {
    formData.set('playerThreeInstagram', payload.playerThreeInstagram);
  }
  if (payload.playerThreeShirtSize) {
    formData.set('playerThreeShirtSize', payload.playerThreeShirtSize);
  }
  if (payload.paymentProof) {
    formData.set('paymentProof', payload.paymentProof);
  }

  return request<PublicRegistrationResponse>('/public/registrations', {
    method: 'POST',
    body: formData,
  });
}

export function getDashboardSummary() {
  return request<DashboardSummary>('/dashboard/summary', {}, true);
}

export function getAdminPosts(params?: {
  section?: string;
  published?: boolean;
  search?: string;
}) {
  return request<ContentPost[]>(
    `/posts${buildQuery({
      section: params?.section,
      published: params?.published,
      search: params?.search,
    })}`,
    {},
    true,
  );
}

export function getAdminPost(id: number) {
  return request<ContentPost>(`/posts/${id}`, {}, true);
}

export function createPost(payload: PostPayload) {
  return request<ContentPost>(
    '/posts',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function updatePost(id: number, payload: PostPayload) {
  return request<ContentPost>(
    `/posts/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function deletePost(id: number) {
  return request<{ success: boolean }>(`/posts/${id}`, { method: 'DELETE' }, true);
}

export function getLocalities(search?: string) {
  return request<Locality[]>(`/localities${buildQuery({ search })}`, {}, true);
}

export function getCategories() { return request<Category[]>('/categories', {}, true); }
export function createCategory(payload: CategoryPayload) { return request<Category>('/categories', { method: 'POST', body: JSON.stringify(payload) }, true); }
export function updateCategory(id: number, payload: Partial<CategoryPayload>) { return request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, true); }
export function deleteCategory(id: number) { return request<{ success: boolean }>(`/categories/${id}`, { method: 'DELETE' }, true); }
export function getCourts(search?: string) { return request<Court[]>(`/courts${buildQuery({ search })}`, {}, true); }
export function createCourt(payload: CourtPayload) { return request<Court>('/courts', { method: 'POST', body: JSON.stringify(payload) }, true); }
export function updateCourt(id: number, payload: CourtPayload) { return request<Court>(`/courts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, true); }
export function deleteCourt(id: number) { return request<{ success: boolean }>(`/courts/${id}`, { method: 'DELETE' }, true); }
export function getTournaments() { return request<Tournament[]>('/tournaments', {}, true); }
export function createTournament(payload: TournamentPayload) { return request<Tournament>('/tournaments', { method: 'POST', body: JSON.stringify(payload) }, true); }
export function getTournament(id: number) { return request<TournamentDetail>(`/tournaments/${id}`, {}, true); }
export function addTournamentCategory(id: number, payload: { categoryId: number; pointsPerSet: number; setsToWin: number; zoneSize: number }) { return request(`/tournaments/${id}/categories`, { method: 'POST', body: JSON.stringify(payload) }, true); }
export function createTournamentZone(payload: { tournamentCategoryId: number; courtId: number; name: string; capacity: number }) { return request('/tournaments/zones', { method: 'POST', body: JSON.stringify(payload) }, true); }
export function getZoneMatches(id: number) { return request<TournamentMatch[]>(`/tournaments/zones/${id}/matches`, {}, true); }
export function generateZoneFixture(id: number) { return request<TournamentMatch[]>(`/tournaments/zones/${id}/fixture`, { method: 'POST' }, true); }
export function saveMatchResult(id: number, homeScore: number, awayScore: number) { return request<TournamentMatch>(`/tournaments/matches/${id}/result`, { method: 'POST', body: JSON.stringify({ homeScore, awayScore }) }, true); }
export function getZone(id: number) { return request<ZoneDetail>(`/tournaments/zones/${id}`, {}, true); }
export function getAvailableZoneRegistrations(categoryId: number) { return request<PairRegistration[]>(`/tournaments/categories/${categoryId}/registrations`, {}, true); }
export function addZoneEntry(zoneId: number, registrationId: number) { return request(`/tournaments/zones/${zoneId}/entries`, { method: 'POST', body: JSON.stringify({ registrationId }) }, true); }

export function createLocality(payload: LocalityPayload) {
  return request<Locality>('/localities', { method: 'POST', body: JSON.stringify(payload) }, true);
}

export function updateLocality(id: number, payload: LocalityPayload) {
  return request<Locality>(`/localities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, true);
}

export function deleteLocality(id: number) {
  return request<{ success: boolean }>(`/localities/${id}`, { method: 'DELETE' }, true);
}

export function getPlayers(search?: string) {
  return request<Player[]>(`/players${buildQuery({ search })}`, {}, true);
}

export function createPlayer(payload: PlayerPayload) {
  return request<Player>('/players', { method: 'POST', body: JSON.stringify(payload) }, true);
}

export function updatePlayer(id: number, payload: PlayerPayload) {
  return request<Player>(`/players/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, true);
}

export function deletePlayer(id: number) {
  return request<{ success: boolean }>(`/players/${id}`, { method: 'DELETE' }, true);
}

export function getRegistrations(params?: {
  category?: string;
  status?: string;
  search?: string;
}) {
  return request<PairRegistration[]>(
    `/registrations${buildQuery({
      category: params?.category,
      status: params?.status,
      search: params?.search,
    })}`,
    {},
    true,
  );
}

export function updateRegistrationStatus(id: number, payload: RegistrationStatusPayload) {
  return request<PairRegistration>(
    `/registrations/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function getAccessGrants(params?: {
  category?: string;
  status?: string;
  search?: string;
}) {
  return request<RegistrationAccessGrant[]>(
    `/registrations/access-grants${buildQuery({
      category: params?.category,
      status: params?.status,
      search: params?.search,
    })}`,
    {},
    true,
  );
}

export function createAccessGrant(payload: AccessGrantPayload) {
  return request<RegistrationAccessGrant>(
    '/registrations/access-grants',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function updateAccessGrantStatus(id: number, payload: AccessGrantStatusPayload) {
  return request<RegistrationAccessGrant>(
    `/registrations/access-grants/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function getPaymentProofUrl(id: number) {
  return `${API_URL}/registrations/${id}/payment-proof`;
}

export async function openRegistrationPaymentProof(id: number) {
  const token = getToken();
  const response = await fetch(getPaymentProofUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
}
