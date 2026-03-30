import type {
  BookingRecord,
  BookingSportType,
  CourtOption,
  CreateBookingPayload,
  UpdateBookingPayload,
} from '../types/booking';
import type {
  BusinessLocationRow,
  BusinessRow,
  IamUserRow,
  InvoiceRow,
  NamedCourt,
  SessionUser,
} from '../types/domain';

const LS_API = 'bukit_saas_api_url';
const LS_TENANT = 'bukit_saas_tenant_id';
const LS_TOKEN = 'bukit_saas_token';
const LS_REFRESH = 'bukit_saas_refresh_token';

const TOKENS_UPDATED = 'bukit_saas_tokens_updated';

function notifyTokensUpdated(): void {
  window.dispatchEvent(new CustomEvent(TOKENS_UPDATED));
}

export function subscribeTokensUpdated(fn: () => void): () => void {
  window.addEventListener(TOKENS_UPDATED, fn);
  return () => window.removeEventListener(TOKENS_UPDATED, fn);
}

export function getApiBase(): string {
  return (
    import.meta.env.VITE_API_URL ||
    localStorage.getItem(LS_API) ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function getTenantId(): string {
  return localStorage.getItem(LS_TENANT)?.trim() || '';
}

export function getToken(): string {
  return localStorage.getItem(LS_TOKEN)?.trim() || '';
}

export function getRefreshToken(): string {
  return localStorage.getItem(LS_REFRESH)?.trim() || '';
}

export function persistConnection(opts: {
  apiBase: string;
  tenantId: string;
  token: string;
  /** When set, updates stored refresh token (omit to leave existing value). */
  refreshToken?: string;
}): void {
  // Defensive: sometimes API responses / state updates can introduce `undefined`
  // at runtime even if TypeScript types say `string`.
  const apiBase = (opts.apiBase ?? '').toString().trim().replace(/\/$/, '');
  const tenantId = (opts.tenantId ?? '').toString().trim();
  const token = (opts.token ?? '').toString().trim();

  localStorage.setItem(LS_API, apiBase);
  localStorage.setItem(LS_TENANT, tenantId);
  localStorage.setItem(LS_TOKEN, token);
  if (opts.refreshToken !== undefined) {
    const rt = (opts.refreshToken ?? '').toString().trim();
    if (rt) localStorage.setItem(LS_REFRESH, rt);
    else localStorage.removeItem(LS_REFRESH);
  }
}

export function setTenantIdStorage(tenantId: string): void {
  localStorage.setItem(LS_TENANT, (tenantId ?? '').toString().trim());
}

/** Clears access + refresh tokens from local storage (e.g. sign out). */
export function clearAuthLocalStorage(): void {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_REFRESH);
}

function headers(json = true): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const tenant = getTenantId();
  if (tenant) h['X-Tenant-Id'] = tenant;
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function headersForTenant(tenantId: string, json = true): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const tenant = (tenantId ?? '').toString().trim();
  if (tenant) h['X-Tenant-Id'] = tenant;
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join(', ');
    if (typeof data.message === 'string') return data.message;
  } catch {
    /* ignore */
  }
  return res.statusText || `HTTP ${res.status}`;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const rt = getRefreshToken();
      if (!rt) return false;
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as {
          token?: string;
          refreshToken?: string;
        };
        const token = (data.token ?? '').trim();
        if (!token) return false;
        localStorage.setItem(LS_TOKEN, token);
        const nextRt = (data.refreshToken ?? '').trim();
        if (nextRt) localStorage.setItem(LS_REFRESH, nextRt);
        notifyTokensUpdated();
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function shouldAttemptRefreshOn401(path: string): boolean {
  if (path === '/auth/refresh' || path === '/auth/login') return false;
  return !!getRefreshToken();
}

async function parseSuccessBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return undefined as T;
  return res.json() as Promise<T>;
}

async function requestOnce<T>(
  path: string,
  init: RequestInit,
  retriedAfterRefresh: boolean,
): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...headers(!(init.body instanceof FormData)),
      ...(init.headers as Record<string, string>),
    },
  });

  if (
    res.status === 401 &&
    !retriedAfterRefresh &&
    shouldAttemptRefreshOn401(path)
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return requestOnce<T>(path, init, true);
    }
  }

  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return parseSuccessBody<T>(res);
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return requestOnce<T>(path, init, false);
}

async function requestForTenantOnce<T>(
  tenantId: string,
  path: string,
  init: RequestInit,
  retriedAfterRefresh: boolean,
): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...headersForTenant(tenantId, !(init.body instanceof FormData)),
      ...(init.headers as Record<string, string>),
    },
  });

  if (
    res.status === 401 &&
    !retriedAfterRefresh &&
    shouldAttemptRefreshOn401(path)
  ) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return requestForTenantOnce<T>(tenantId, path, init, true);
    }
  }

  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return parseSuccessBody<T>(res);
}

export async function requestForTenant<T>(
  tenantId: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return requestForTenantOnce<T>(tenantId, path, init, false);
}

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  return request('/health', { method: 'GET' });
}

export async function fetchSessionUser(): Promise<SessionUser> {
  return request<SessionUser>('/iam/me', { method: 'GET' });
}

export async function listBusinesses(): Promise<BusinessRow[]> {
  return request<BusinessRow[]>('/businesses', { method: 'GET' });
}

export async function listBusinessLocations(): Promise<BusinessLocationRow[]> {
  return request<BusinessLocationRow[]>('/businesses/locations', {
    method: 'GET',
  });
}

export async function createBusinessLocation(body: {
  businessId: string;
  branchName?: string;
  locationType: string;
  facilityTypes?: string[];
  name: string;
  addressLine?: string;
  city?: string;
  area?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  manager?: string;
  workingHours?: Record<string, unknown>;
  timezone?: string;
  currency?: string;
  logo?: string;
  gallery?: string[];
  status?: string;
  location?: {
    country?: string;
    city?: string;
    area?: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  };
  contact?: {
    phone?: string;
    manager?: string;
  };
  settings?: {
    timezone?: string;
    currency?: string;
  };
}): Promise<unknown> {
  return request('/businesses/locations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateBusinessLocation(
  locationId: string,
  body: {
    branchName?: string;
    locationType?: string;
    facilityTypes?: string[];
    name?: string;
    addressLine?: string;
    city?: string;
    area?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    manager?: string;
    workingHours?: Record<string, unknown>;
    timezone?: string;
    currency?: string;
    logo?: string;
    gallery?: string[];
    status?: string;
    location?: {
      country?: string;
      city?: string;
      area?: string;
      address?: string;
      coordinates?: { lat: number; lng: number };
    };
    contact?: {
      phone?: string;
      manager?: string;
    };
    settings?: {
      timezone?: string;
      currency?: string;
    };
  },
): Promise<unknown> {
  return request(`/businesses/locations/${locationId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteBusinessLocation(
  locationId: string,
): Promise<{ deleted: true; locationId: string }> {
  return request<{ deleted: true; locationId: string }>(
    `/businesses/locations/${locationId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function onboardBusiness(body: {
  tenantId?: string;
  businessName: string;
  legalName?: string;
  businessType?: string;
  sportsOffered?: string[];
  owner?: {
    name: string;
    email: string;
    phone?: string;
    password?: string;
  };
  admin?: { fullName: string; email: string; phone?: string; password: string };
  subscription?: {
    plan?: string;
    status?: string;
    billingCycle?: string;
  };
  settings?: {
    timezone?: string;
    currency?: string;
    allowOnlinePayments?: boolean;
  };
  status?: string;
}): Promise<unknown> {
  return request('/businesses/onboard', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateBusiness(
  businessId: string,
  body: {
    businessName?: string;
    legalName?: string;
    businessType?: string;
    sportsOffered?: string[];
    owner?: { name?: string; email?: string; phone?: string };
    subscription?: { plan?: string; status?: string; billingCycle?: string };
    settings?: {
      timezone?: string;
      currency?: string;
      allowOnlinePayments?: boolean;
    };
    status?: string;
  },
): Promise<BusinessRow> {
  return request<BusinessRow>(`/businesses/${businessId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteBusiness(
  businessId: string,
): Promise<{ deleted: true; businessId: string }> {
  return request<{ deleted: true; businessId: string }>(`/businesses/${businessId}`, {
    method: 'DELETE',
  });
}

export async function listIamUsers(): Promise<IamUserRow[]> {
  return request<IamUserRow[]>('/iam/users', { method: 'GET' });
}

/** Platform owner only — users with customer-end-user role. */
export async function listEndUsers(): Promise<IamUserRow[]> {
  return request<IamUserRow[]>('/iam/end-users', { method: 'GET' });
}

export async function createIamUser(body: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<IamUserRow> {
  return request<IamUserRow>('/iam/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateIamUser(
  userId: string,
  body: {
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
  },
): Promise<IamUserRow> {
  return request<IamUserRow>(`/iam/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteIamUser(
  userId: string,
): Promise<{ deleted: true; userId: string }> {
  return request<{ deleted: true; userId: string }>(`/iam/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function assignRole(body: {
  userId: string;
  role: string;
}): Promise<unknown> {
  return request('/iam/roles/assign', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listBookings(): Promise<BookingRecord[]> {
  return request<BookingRecord[]>('/bookings', { method: 'GET' });
}

export async function listBookingsForTenant(
  tenantId: string,
): Promise<BookingRecord[]> {
  return requestForTenant<BookingRecord[]>(tenantId, '/bookings', {
    method: 'GET',
  });
}

export async function getBooking(bookingId: string): Promise<BookingRecord> {
  return request<BookingRecord>(`/bookings/${bookingId}`, { method: 'GET' });
}

export async function createBooking(
  body: CreateBookingPayload,
): Promise<BookingRecord> {
  return request<BookingRecord>('/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateBooking(
  bookingId: string,
  body: UpdateBookingPayload,
): Promise<BookingRecord> {
  return request<BookingRecord>(`/bookings/${bookingId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function listInvoices(): Promise<InvoiceRow[]> {
  return request<InvoiceRow[]>('/billing/invoices', { method: 'GET' });
}

export async function listInvoicesForTenant(tenantId: string): Promise<InvoiceRow[]> {
  return requestForTenant<InvoiceRow[]>(tenantId, '/billing/invoices', {
    method: 'GET',
  });
}

export async function issueInvoice(body: {
  bookingId: string;
  amount: number;
}): Promise<InvoiceRow> {
  return request<InvoiceRow>('/billing/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getArenaMeta(): Promise<unknown> {
  return request('/arena', { method: 'GET' });
}

function appendLocationQuery(
  base: string,
  sport: string | undefined,
  businessLocationId: string | undefined,
): string {
  const p = new URLSearchParams();
  if (sport) p.set('sport', sport);
  if (businessLocationId?.trim()) p.set('businessLocationId', businessLocationId.trim());
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function listTurfCourts(
  sport?: 'futsal' | 'cricket',
  businessLocationId?: string,
): Promise<NamedCourt[]> {
  return request<NamedCourt[]>(
    appendLocationQuery('/arena/turf-courts', sport, businessLocationId),
    { method: 'GET' },
  );
}

export async function listPadelCourts(
  businessLocationId?: string,
): Promise<NamedCourt[]> {
  const q = businessLocationId?.trim()
    ? `?businessLocationId=${encodeURIComponent(businessLocationId.trim())}`
    : '';
  return request<NamedCourt[]>(`/arena/padel-court${q}`, { method: 'GET' });
}

export async function listFutsalFields(
  businessLocationId?: string,
): Promise<NamedCourt[]> {
  const q = businessLocationId?.trim()
    ? `?businessLocationId=${encodeURIComponent(businessLocationId.trim())}`
    : '';
  return request<NamedCourt[]>(`/arena/futsal-field${q}`, { method: 'GET' });
}

export async function listCricketIndoor(
  businessLocationId?: string,
): Promise<NamedCourt[]> {
  const q = businessLocationId?.trim()
    ? `?businessLocationId=${encodeURIComponent(businessLocationId.trim())}`
    : '';
  return request<NamedCourt[]>(`/arena/cricket-indoor${q}`, { method: 'GET' });
}

/** Matches API `CreateTurfCourtDto` (optional fields omitted when unset). */
export type CreateTurfCourtBody = {
  businessLocationId: string;
  name: string;
  sportMode: 'futsal_only' | 'cricket_only' | 'both';
  arenaLabel?: string;
  courtStatus?: 'active' | 'maintenance';
  imageUrls?: string[];
  ceilingHeightValue?: number;
  ceilingHeightUnit?: 'ft' | 'm';
  coveredType?: 'open' | 'semi_covered' | 'fully_indoor';
  sideNetting?: boolean;
  netHeight?: string;
  boundaryType?: 'net' | 'wall';
  ventilation?: ('natural' | 'fans' | 'ac')[];
  lighting?: 'led_floodlights' | 'mixed' | 'daylight';
  lengthM?: number;
  widthM?: number;
  surfaceType?: 'artificial_turf' | 'hard_surface';
  turfQuality?: string;
  shockAbsorptionLayer?: boolean;
  futsalFormat?: '5v5' | '6v6' | '7v7';
  futsalGoalPostsAvailable?: boolean;
  futsalGoalPostSize?: string;
  futsalLineMarkings?: 'permanent' | 'temporary';
  cricketFormat?: 'tape_ball' | 'tennis_ball' | 'hard_ball';
  cricketStumpsAvailable?: boolean;
  cricketBowlingMachine?: boolean;
  cricketPracticeMode?: 'full_ground' | 'nets_mode';
  futsalPricePerSlot?: number;
  cricketPricePerSlot?: number;
  peakPricing?: { weekdayEvening?: number; weekend?: number };
  discountMembership?: {
    label?: string;
    amount?: number;
    percentOff?: number;
  };
  slotDurationMinutes?: 30 | 60;
  bufferBetweenSlotsMinutes?: number;
  allowParallelBooking?: boolean;
  amenities?: {
    changingRoom?: boolean;
    washroom?: boolean;
    parking?: boolean;
    drinkingWater?: boolean;
    seatingArea?: boolean;
  };
  rules?: {
    maxPlayers?: number;
    safetyInstructions?: string;
    cancellationPolicy?: string;
  };
};

export async function createTurfCourt(
  body: CreateTurfCourtBody,
): Promise<NamedCourt> {
  return request<NamedCourt>('/arena/turf-courts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateTurfCourt(
  id: string,
  body: Partial<CreateTurfCourtBody>,
): Promise<NamedCourt> {
  return request<NamedCourt>(`/arena/turf-courts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteTurfCourt(
  id: string,
): Promise<{ deleted: true; id: string }> {
  return request<{ deleted: true; id: string }>(`/arena/turf-courts/${id}`, {
    method: 'DELETE',
  });
}

export async function createPadelCourt(body: {
  businessLocationId: string;
  name: string;
}): Promise<NamedCourt> {
  return request<NamedCourt>('/arena/padel-court', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updatePadelCourt(
  id: string,
  body: { name?: string },
): Promise<NamedCourt> {
  return request<NamedCourt>(`/arena/padel-court/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deletePadelCourt(
  id: string,
): Promise<{ deleted: true; id: string }> {
  return request<{ deleted: true; id: string }>(`/arena/padel-court/${id}`, {
    method: 'DELETE',
  });
}

export async function createFutsalField(body: {
  businessLocationId: string;
  name: string;
  description?: string;
  dimensions?: string;
}): Promise<NamedCourt> {
  return request<NamedCourt>('/arena/futsal-field', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateFutsalField(
  id: string,
  body: { name?: string; description?: string; dimensions?: string },
): Promise<NamedCourt> {
  return request<NamedCourt>(`/arena/futsal-field/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteFutsalField(
  id: string,
): Promise<{ deleted: true; id: string }> {
  return request<{ deleted: true; id: string }>(`/arena/futsal-field/${id}`, {
    method: 'DELETE',
  });
}

export async function createCricketIndoorCourt(body: {
  businessLocationId: string;
  name: string;
  description?: string;
  laneCount?: number;
}): Promise<NamedCourt> {
  return request<NamedCourt>('/arena/cricket-indoor', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCricketIndoorCourt(
  id: string,
  body: { name?: string; description?: string; laneCount?: number },
): Promise<NamedCourt> {
  return request<NamedCourt>(`/arena/cricket-indoor/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteCricketIndoorCourt(
  id: string,
): Promise<{ deleted: true; id: string }> {
  return request<{ deleted: true; id: string }>(`/arena/cricket-indoor/${id}`, {
    method: 'DELETE',
  });
}

export async function listCourtOptions(
  sport: BookingSportType,
): Promise<CourtOption[]> {
  if (!getToken() || !getTenantId()) return [];
  try {
    const out: CourtOption[] = [];
    if (sport === 'padel') {
      const rows = await listPadelCourts();
      for (const r of rows) {
        out.push({
          kind: 'padel_court',
          id: r.id,
          label: `Padel — ${r.name}`,
        });
      }
    } else if (sport === 'futsal') {
      const [turf, fields] = await Promise.all([
        listTurfCourts('futsal'),
        listFutsalFields(),
      ]);
      for (const r of turf) {
        out.push({
          kind: 'turf_court',
          id: r.id,
          label: `Turf — ${r.name}`,
        });
      }
      for (const r of fields) {
        out.push({
          kind: 'futsal_field',
          id: r.id,
          label: `Futsal field — ${r.name}`,
        });
      }
    } else {
      const [turf, indoor] = await Promise.all([
        listTurfCourts('cricket'),
        listCricketIndoor(),
      ]);
      for (const r of turf) {
        out.push({
          kind: 'turf_court',
          id: r.id,
          label: `Turf — ${r.name}`,
        });
      }
      for (const r of indoor) {
        out.push({
          kind: 'cricket_indoor_court',
          id: r.id,
          label: `Cricket indoor — ${r.name}`,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}
