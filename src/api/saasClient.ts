import type {
  BookingAvailabilityRecord,
  BookingRecord,
  BookingSportType,
  CourtKind,
  CourtOption,
  CourtSlotGridRecord,
  CourtSlotsRecord,
  CreateBookingPayload,
  UpdateBookingPayload,
} from '../types/booking';
import type {
  BusinessDashboardView,
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

/** Used when `VITE_IMAGE_UPLOAD_URL` is missing or blank in `.env` at build time. */
const DEFAULT_IMAGE_UPLOAD_URL = 'https://bukit.osamaqaseem.online/upload.php';

const rawImageUploadUrl = import.meta.env.VITE_IMAGE_UPLOAD_URL as
  | string
  | undefined;
/** Empty or whitespace in `.env` must not skip uploads — otherwise we hit `/auth/upload` on the API base (e.g. old Vercel URL in localStorage). */
const IMAGE_UPLOAD_URL =
  (rawImageUploadUrl ?? '').trim() || DEFAULT_IMAGE_UPLOAD_URL;

/** Form field name for the file part (`$_FILES[...]` in PHP). */
const IMAGE_UPLOAD_FORM_FIELD =
  (import.meta.env.VITE_IMAGE_UPLOAD_FORM_FIELD || 'file').trim() || 'file';

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



export interface UploadImageResult {
  url: string;
  filename?: string;
  size?: number;
}

function pickString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function parseExternalUploadResponse(
  json: unknown,
  resOk: boolean,
): UploadImageResult {
  const o = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};

  if (o.success === false) {
    throw new Error(pickString(o.message, o.error) || 'Image upload failed');
  }

  const data =
    o.data && typeof o.data === 'object'
      ? (o.data as Record<string, unknown>)
      : undefined;

  const url = pickString(
    o.url,
    o.link,
    o.file,
    o.path,
    data?.url,
    data?.link,
    data?.file,
    data?.path,
  );

  if (!resOk) {
    throw new Error(
      pickString(o.message, o.error) || `Image upload failed (HTTP error)`,
    );
  }

  if (!url) {
    throw new Error(
      pickString(o.message, o.error) ||
        'Image upload failed: response did not include a URL',
    );
  }

  const filename = pickString(data?.filename, o.filename) || undefined;
  const sizeRaw = data?.size ?? o.size;
  const size = typeof sizeRaw === 'number' ? sizeRaw : undefined;

  return { url, filename, size };
}

/** Origin of the upload script (for resolving relative paths like `/uploads/x.jpg`). */
export function getImageUploadOrigin(): string {
  if (!IMAGE_UPLOAD_URL) return '';
  try {
    return new URL(IMAGE_UPLOAD_URL).origin;
  } catch {
    return '';
  }
}

/** Absolute URL for displaying a stored image path (handles relative URLs from PHP). */
export function resolvePublicImageUrl(url: string): string {
  if (!url) return url;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const uploadOrigin = getImageUploadOrigin().replace(/\/$/, '');
  const base = uploadOrigin || getApiBase().replace(/\/$/, '');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

export async function uploadImageApi(file: File): Promise<UploadImageResult> {
  const formData = new FormData();
  formData.append(IMAGE_UPLOAD_FORM_FIELD, file);

  const res = await fetch(IMAGE_UPLOAD_URL, {
    method: 'POST',
    body: formData,
    credentials: 'omit',
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(
      res.ok
        ? 'Image upload failed: server did not return JSON'
        : `Image upload failed (${res.status})`,
    );
  }
  return parseExternalUploadResponse(json, res.ok);
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

export async function listBusinessLocations(opts?: {
  /**
   * Sends an empty `X-Tenant-Id` for this request so the API does not narrow by the
   * active tenant (platform-owner cross-tenant overview needs every location).
   */
  ignoreActiveTenant?: boolean;
  /** Case-insensitive substring on location name (`GET /businesses/locations?name=`). */
  name?: string;
}): Promise<BusinessLocationRow[]> {
  const base = headers() as Record<string, string>;
  if (opts?.ignoreActiveTenant) {
    base['X-Tenant-Id'] = '';
  }
  const q = new URLSearchParams();
  if (opts?.name?.trim()) q.set('name', opts.name.trim());
  const qs = q.toString();
  return request<BusinessLocationRow[]>(
    `/businesses/locations${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      headers: base,
    },
  );
}

/** Row from `GET /businesses/locations/name-ids` (id + name only). */
export type BusinessLocationNameId = { id: string; name: string };

/** Lightweight location id/name list for boot or typeahead (same auth/tenant as full list). */
export async function listBusinessLocationNameIds(opts?: {
  ignoreActiveTenant?: boolean;
  name?: string;
}): Promise<{ locations: BusinessLocationNameId[] }> {
  const base = headers() as Record<string, string>;
  if (opts?.ignoreActiveTenant) {
    base['X-Tenant-Id'] = '';
  }
  const q = new URLSearchParams();
  if (opts?.name?.trim()) q.set('name', opts.name.trim());
  const qs = q.toString();
  return request<{ locations: BusinessLocationNameId[] }>(
    `/businesses/locations/name-ids${qs ? `?${qs}` : ''}`,
    { method: 'GET', headers: base },
  );
}

/** Map/sidebar marker row from GET /public/venues/markers[...] */
export type VenueMapMarker = {
  venueId: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  logo: string | null;
  bannerImage: string | null;
};

/** Distinct city names for filters (legacy: GET /getAllCities). */
export async function getAllCities(params?: {
  q?: string;
  limit?: number;
}): Promise<{ cities: string[] }> {
  const q = new URLSearchParams();
  if (params?.q) q.set('q', params.q);
  if (params?.limit != null) q.set('limit', String(params.limit));
  const qs = q.toString();
  return request(`/public/cities${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

/** Registered catalog + every distinct locationType in DB (any location). */
export async function getAllLocationTypes(): Promise<{
  locationTypes: string[];
}> {
  return request('/public/location-types', { method: 'GET' });
}

/** Short map markers for all active venues (legacy GET /getVenues, same as GET /public/venues/markers). */
export async function getVenues(): Promise<VenueMapMarker[]> {
  return request<VenueMapMarker[]>('/public/venues/markers', { method: 'GET' });
}

export async function getVenuesAllMarkers(): Promise<VenueMapMarker[]> {
  return request<VenueMapMarker[]>('/public/venues/markers', {
    method: 'GET',
  });
}

export async function getVenuesGamingMarkers(): Promise<VenueMapMarker[]> {
  return request<VenueMapMarker[]>('/public/venues/markers/gaming', {
    method: 'GET',
  });
}

export async function getVenuesFutsalArenasMarkers(): Promise<VenueMapMarker[]> {
  return request<VenueMapMarker[]>('/public/venues/markers/futsal', {
    method: 'GET',
  });
}

/** GET /public/venues/:id — full {@link BusinessLocationRow} plus legacy/detail helpers. */
export type VenueDetailsPublic = Omit<BusinessLocationRow, 'business'> & {
  business: {
    id: string;
    tenantId: string;
    businessName: string;
    legalName?: string | null;
    status?: string;
    createdAt?: string;
    settings?: Record<string, unknown> | null;
  } | null;
  venueId: string;
  address: string;
  clubDetails: {
    businessName: string | null;
    description: string | null;
    sportsOffered: string[];
  };
  price: number | null;
  packages: unknown[];
  availability: { tenantId: string | null; note: string };
  dailyOpenHours: Record<string, unknown> | null;
  facilityAvailable: Array<{ label: string; count: number }>;
  facilityList: Array<{
    id: string;
    name: string;
    facilityType: 'futsal' | 'cricket' | 'padel';
    locationId: string;
  }>;
  tenantId: string | null;
};

export async function getVenueDetails(
  locationId: string,
): Promise<VenueDetailsPublic> {
  return request<VenueDetailsPublic>(`/public/venues/${locationId}`, {
    method: 'GET',
  });
}

/** Query for GET /businesses/locations/search — matches API `SearchLocationsQueryDto`. */
export type SearchPublicLocationsParams = {
  cities?: string;
  /** Site kind (e.g. `arena`) or facility filter: `futsal` | `cricket` | `padel` (optional `-court`). */
  locationType?: string;
  bookingStatus?: 'unbooked';
  date?: string;
  startTime?: string;
  endTime?: string;
};

/** Same item shape as {@link getVenues} (short map markers). */
export async function searchPublicLocations(
  params: SearchPublicLocationsParams = {},
): Promise<VenueMapMarker[]> {
  const q = new URLSearchParams();
  if (params.cities?.trim()) q.set('cities', params.cities.trim());
  if (params.locationType?.trim()) {
    q.set('locationType', params.locationType.trim());
  }
  if (params.bookingStatus) q.set('bookingStatus', params.bookingStatus);
  if (params.date?.trim()) q.set('date', params.date.trim());
  if (params.startTime?.trim()) q.set('startTime', params.startTime.trim());
  if (params.endTime?.trim()) q.set('endTime', params.endTime.trim());
  const qs = q.toString();
  return request<VenueMapMarker[]>(
    `/businesses/locations/search${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

export type PlacePublicBookingBody = {
  date: string;
  startTime: string;
  endTime: string;
  facilitySelected: string;
  fieldSelected: string;
  venueId: string;
  userId: string;
};

export type PlacePublicBookingResponse = {
  message: string;
  bookingId: string;
  placedAt: string;
};

export async function placeFutsalBooking(
  body: PlacePublicBookingBody,
): Promise<PlacePublicBookingResponse> {
  return request('/public/bookings/futsal', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function placeCricketBooking(
  body: PlacePublicBookingBody,
): Promise<PlacePublicBookingResponse> {
  return request('/public/bookings/cricket', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function placePadelBooking(
  body: PlacePublicBookingBody,
): Promise<PlacePublicBookingResponse> {
  return request('/public/bookings/padel', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getBusinessDashboardView(): Promise<BusinessDashboardView> {
  return request<BusinessDashboardView>('/businesses/dashboard', {
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
  details?: string;
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
  bannerImage?: string;
  gallery?: string[];
  status?: string;
  location?: {
    country?: string;
    city?: string;
    area?: string;
    addressLine?: string;
    address?: string;
    details?: string;
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
    details?: string;
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
    bannerImage?: string;
    gallery?: string[];
    status?: string;
    location?: {
      country?: string;
      city?: string;
      area?: string;
      addressLine?: string;
      address?: string;
      details?: string;
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

export async function listIamUsers(
  params?: {
    search?: string;
    sortBy?: 'fullName' | 'email' | 'createdAt';
    sortOrder?: 'ASC' | 'DESC';
  },
  /** When set, uses this tenant for `X-Tenant-Id` instead of the stored active tenant. */
  tenantIdOverride?: string,
): Promise<IamUserRow[]> {
  const q = new URLSearchParams();
  const search = params?.search?.trim();
  if (search) q.set('search', search);
  if (params?.sortBy) q.set('sortBy', params.sortBy);
  if (params?.sortOrder) q.set('sortOrder', params.sortOrder);
  const query = q.toString();
  const path = query ? `/iam/users?${query}` : '/iam/users';
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (!tid) return [];
  return requestForTenant<IamUserRow[]>(tid, path, { method: 'GET' });
}

/** Platform owner only — users with customer-end-user role. */
export async function listEndUsers(): Promise<IamUserRow[]> {
  return request<IamUserRow[]>('/iam/end-users', { method: 'GET' });
}

export async function createIamUser(
  body: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
  },
  /** When set, uses this tenant for `X-Tenant-Id` instead of the stored active tenant. */
  tenantIdOverride?: string,
): Promise<IamUserRow> {
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (!tid) {
    throw new Error('Tenant is required to create a user.');
  }
  return requestForTenant<IamUserRow>(tid, '/iam/users', {
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
): Promise<{ deactivated: true; userId: string }> {
  return request<{ deactivated: true; userId: string }>(`/iam/users/${userId}`, {
    method: 'DELETE',
  });
}

/** Platform owner only — sets `isActive` so the user can sign in again. */
export async function activateIamUser(userId: string): Promise<IamUserRow> {
  return request<IamUserRow>(`/iam/users/${userId}/activate`, {
    method: 'POST',
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

export async function createBookingForTenant(
  tenantId: string,
  body: CreateBookingPayload,
): Promise<BookingRecord> {
  return requestForTenant<BookingRecord>(tenantId, '/bookings', {
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

export async function getBookingAvailability(params: {
  date: string;
  startTime: string;
  endTime: string;
  sportType?: BookingSportType;
}): Promise<BookingAvailabilityRecord> {
  const q = new URLSearchParams();
  q.set('date', params.date);
  q.set('startTime', params.startTime);
  q.set('endTime', params.endTime);
  if (params.sportType) q.set('sportType', params.sportType);
  return request<BookingAvailabilityRecord>(`/bookings/availability?${q.toString()}`, {
    method: 'GET',
  });
}

export async function getCourtSlots(params: {
  courtKind: CourtKind;
  courtId: string;
  date: string;
  startTime?: string;
  endTime?: string;
}): Promise<CourtSlotsRecord> {
  const q = new URLSearchParams();
  q.set('date', params.date);
  if (params.startTime) q.set('startTime', params.startTime);
  if (params.endTime) q.set('endTime', params.endTime);
  return request<CourtSlotsRecord>(
    `/bookings/courts/${params.courtKind}/${params.courtId}/slots?${q.toString()}`,
    { method: 'GET' },
  );
}

/** Backward-compatible alias. */
export const getCourtBookedSlots = getCourtSlots;

/** Idempotent: insert default hourly slot rows for the date (linked twins included). */
export async function generateCourtFacilityDaySlots(params: {
  courtKind: CourtKind;
  courtId: string;
  date: string;
}): Promise<{ ok: true; upserted: number }> {
  return request<{ ok: true; upserted: number }>(
    `/bookings/courts/${params.courtKind}/${params.courtId}/facility-slots/generate`,
    {
      method: 'POST',
      body: JSON.stringify({ date: params.date }),
    },
  );
}

export async function patchCourtFacilitySlot(params: {
  courtKind: CourtKind;
  courtId: string;
  date: string;
  startTime: string;
  status: 'available' | 'blocked';
}): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/bookings/courts/${params.courtKind}/${params.courtId}/facility-slots`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        date: params.date,
        startTime: params.startTime,
        status: params.status,
      }),
    },
  );
}

/** Hourly segments for one facility/court for a day (or optional time window). */
export async function getCourtSlotGrid(params: {
  courtKind: CourtKind;
  courtId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  /** Optional informational overlay: align grid to location working hours (ignored if start/end are set). */
  useWorkingHours?: boolean;
  /** Only free segments — use for booking pickers so booked times are omitted. */
  availableOnly?: boolean;
  /** When set, uses this tenant for `X-Tenant-Id` instead of the stored active tenant. */
  tenantId?: string;
}): Promise<CourtSlotGridRecord> {
  const {
    courtKind,
    courtId,
    date,
    startTime,
    endTime,
    useWorkingHours,
    availableOnly,
    tenantId: tenantOverride,
  } = params;
  const q = new URLSearchParams();
  q.set('date', date);
  if (startTime) q.set('startTime', startTime);
  if (endTime) q.set('endTime', endTime);
  if (useWorkingHours) q.set('useWorkingHours', 'true');
  if (availableOnly) q.set('availableOnly', 'true');
  const path = `/bookings/courts/${courtKind}/${courtId}/slot-grid?${q.toString()}`;
  const normalizeGrid = (raw: unknown): CourtSlotGridRecord => {
    const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const rawSegments = Array.isArray(row.segments) ? row.segments : null;
    const rawSlots = Array.isArray(row.slots) ? row.slots : null;
    const segments =
      rawSegments ??
      (rawSlots
        ? rawSlots
            .map((s) => {
              if (!s || typeof s !== 'object') return null;
              const slot = s as Record<string, unknown>;
              const startTime = typeof slot.startTime === 'string' ? slot.startTime : '';
              const endTime = typeof slot.endTime === 'string' ? slot.endTime : '';
              const availability = typeof slot.availability === 'string' ? slot.availability : '';
              if (!startTime || !endTime) return null;
              if (availability === 'available') {
                return { startTime, endTime, state: 'free' as const };
              }
              if (availability === 'blocked') {
                return { startTime, endTime, state: 'blocked' as const };
              }
              if (availability === 'booked') {
                return {
                  startTime,
                  endTime,
                  state: 'booked' as const,
                  bookingId:
                    typeof slot.bookingId === 'string' ? slot.bookingId : '',
                  itemId: typeof slot.itemId === 'string' ? slot.itemId : '',
                  status:
                    typeof slot.status === 'string' ? slot.status : 'reserved',
                };
              }
              return null;
            })
            .filter(Boolean)
        : []);
    return {
      date: typeof row.date === 'string' ? row.date : date,
      kind: (typeof row.kind === 'string' ? row.kind : courtKind) as CourtKind,
      courtId: typeof row.courtId === 'string' ? row.courtId : courtId,
      segmentMinutes:
        typeof row.segmentMinutes === 'number' ? (row.segmentMinutes as 60) : 60,
      gridStartTime:
        typeof row.gridStartTime === 'string'
          ? row.gridStartTime
          : startTime ?? '00:00',
      gridEndTime:
        typeof row.gridEndTime === 'string' ? row.gridEndTime : endTime ?? '24:00',
      workingHoursApplied:
        typeof row.workingHoursApplied === 'boolean'
          ? row.workingHoursApplied
          : undefined,
      locationClosed:
        typeof row.locationClosed === 'boolean' ? row.locationClosed : undefined,
      availableOnly:
        typeof row.availableOnly === 'boolean' ? row.availableOnly : undefined,
      segments: segments as CourtSlotGridRecord['segments'],
    };
  };
  const tid = (tenantOverride ?? getTenantId()).trim();
  if (tid) {
    return normalizeGrid(await requestForTenant<unknown>(tid, path, { method: 'GET' }));
  }
  return normalizeGrid(await request<unknown>(path, { method: 'GET' }));
}

/** Turn booking on/off for one hourly segment (`blocked: true` = no new bookings). */
export async function setCourtSlotBlock(params: {
  courtKind: CourtKind;
  courtId: string;
  date: string;
  startTime: string;
  blocked: boolean;
}): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/bookings/courts/${params.courtKind}/${params.courtId}/slot-blocks`,
    {
      method: 'PUT',
      body: JSON.stringify({
        date: params.date,
        startTime: params.startTime,
        blocked: params.blocked,
      }),
    },
  );
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

function appendBusinessLocationQuery(
  base: string,
  businessLocationId: string | undefined,
  sportType?: 'futsal' | 'cricket',
): string {
  const p = new URLSearchParams();
  if (businessLocationId?.trim()) {
    p.set('businessLocationId', businessLocationId.trim());
  }
  if (sportType) {
    p.set('sportType', sportType);
  }
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

const ARENA_TURF_COURTS = '/arena/turf-courts';

export async function listFutsalCourts(
  businessLocationId?: string,
  tenantIdOverride?: string,
): Promise<NamedCourt[]> {
  const path = appendBusinessLocationQuery(
    ARENA_TURF_COURTS,
    businessLocationId,
    'futsal',
  );
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (tid) {
    return requestForTenant<NamedCourt[]>(tid, path, { method: 'GET' });
  }
  return request<NamedCourt[]>(path, { method: 'GET' });
}

export async function listCricketCourts(
  businessLocationId?: string,
  tenantIdOverride?: string,
): Promise<NamedCourt[]> {
  const path = appendBusinessLocationQuery(
    ARENA_TURF_COURTS,
    businessLocationId,
    'cricket',
  );
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (tid) {
    return requestForTenant<NamedCourt[]>(tid, path, { method: 'GET' });
  }
  return request<NamedCourt[]>(path, { method: 'GET' });
}

export async function listPadelCourts(
  businessLocationId?: string,
  tenantIdOverride?: string,
): Promise<NamedCourt[]> {
  const q = businessLocationId?.trim()
    ? `?businessLocationId=${encodeURIComponent(businessLocationId.trim())}`
    : '';
  const path = `/arena/padel-court${q}`;
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (tid) {
    return requestForTenant<NamedCourt[]>(tid, path, { method: 'GET' });
  }
  return request<NamedCourt[]>(path, { method: 'GET' });
}

export type CreateTurfTwinLinkBody = {
  futsalCourtId: string;
  cricketCourtId: string;
};

export async function createTurfTwinLink(
  body: CreateTurfTwinLinkBody,
): Promise<{
  message: string;
  link: { futsalCourtId: string; cricketCourtId: string };
}> {
  return request('/arena/turf-twin-links', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type RemoveTurfTwinLinkBody = {
  courtKind: 'futsal_court' | 'cricket_court';
  courtId: string;
};

export async function removeTurfTwinLink(
  body: RemoveTurfTwinLinkBody,
): Promise<{ message: string }> {
  return request('/arena/turf-twin-links/unlink', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Matches API `CreateFutsalCourtDto`. */
export type CreateFutsalCourtBody = {
  businessLocationId: string;
  name: string;
  arenaLabel?: string;
  courtStatus?: 'active' | 'maintenance' | 'draft';
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
  pricePerSlot?: number;
  peakPricing?: { weekdayEvening?: number; weekend?: number };
  discountMembership?: {
    label?: string;
    amount?: number;
    percentOff?: number;
  };
  slotDurationMinutes?: number;
  bufferBetweenSlotsMinutes?: number;
  allowParallelBooking?: boolean;
  /** Linked cricket pitch: same physical turf, one shared booking calendar. */
  linkedTwinCourtKind?: 'futsal_court' | 'cricket_court';
  linkedTwinCourtId?: string;
  /**
   * When true, cricket is stored on this same futsal row (no separate cricket court).
   * Use with cricket* fields for a single dual-sport turf.
   */
  supportsCricket?: boolean;
  cricketFormat?: 'tape_ball' | 'tennis_ball' | 'hard_ball';
  cricketStumpsAvailable?: boolean;
  cricketBowlingMachine?: boolean;
  cricketPracticeMode?: 'full_ground' | 'nets_mode';
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
  timeSlotTemplateId?: string | null;
};

export type FutsalCourtDetail = Partial<CreateFutsalCourtBody> & {
  id: string;
  name: string;
  tenantId?: string;
  businessLocationId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function getFutsalCourt(id: string): Promise<FutsalCourtDetail> {
  return request<FutsalCourtDetail>(`${ARENA_TURF_COURTS}/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export async function createFutsalCourt(
  body: CreateFutsalCourtBody,
): Promise<NamedCourt> {
  return request<NamedCourt>(ARENA_TURF_COURTS, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateFutsalCourt(
  id: string,
  body: Partial<CreateFutsalCourtBody>,
): Promise<NamedCourt> {
  return request<NamedCourt>(
    `${ARENA_TURF_COURTS}/${encodeURIComponent(id)}`,
    {
    method: 'PATCH',
    body: JSON.stringify(body),
  },
  );
}

export async function deleteFutsalCourt(
  id: string,
  tenantIdOverride?: string,
): Promise<{ deleted: true; id: string }> {
  const path = `${ARENA_TURF_COURTS}/${encodeURIComponent(id)}`;
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (tid) {
    return requestForTenant<{ deleted: true; id: string }>(tid, path, {
      method: 'DELETE',
    });
  }
  return request<{ deleted: true; id: string }>(path, { method: 'DELETE' });
}

/** Matches API `CreateCricketCourtDto`. */
export type CreateCricketCourtBody = {
  businessLocationId: string;
  name: string;
  arenaLabel?: string;
  courtStatus?: 'active' | 'maintenance' | 'draft';
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
  cricketFormat?: 'tape_ball' | 'tennis_ball' | 'hard_ball';
  cricketStumpsAvailable?: boolean;
  cricketBowlingMachine?: boolean;
  cricketPracticeMode?: 'full_ground' | 'nets_mode';
  pricePerSlot?: number;
  peakPricing?: { weekdayEvening?: number; weekend?: number };
  discountMembership?: {
    label?: string;
    amount?: number;
    percentOff?: number;
  };
  slotDurationMinutes?: number;
  bufferBetweenSlotsMinutes?: number;
  allowParallelBooking?: boolean;
  linkedTwinCourtKind?: 'futsal_court' | 'cricket_court';
  linkedTwinCourtId?: string;
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
  timeSlotTemplateId?: string | null;
};

export type CricketCourtDetail = Partial<CreateCricketCourtBody> & {
  id: string;
  name: string;
  tenantId?: string;
  businessLocationId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function getCricketCourt(id: string): Promise<CricketCourtDetail> {
  return request<CricketCourtDetail>(`${ARENA_TURF_COURTS}/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export async function createCricketCourt(
  body: CreateCricketCourtBody,
): Promise<NamedCourt> {
  return request<NamedCourt>(ARENA_TURF_COURTS, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCricketCourt(
  id: string,
  body: Partial<CreateCricketCourtBody>,
): Promise<NamedCourt> {
  return request<NamedCourt>(`${ARENA_TURF_COURTS}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteCricketCourt(
  id: string,
  tenantIdOverride?: string,
): Promise<{ deleted: true; id: string }> {
  const path = `${ARENA_TURF_COURTS}/${encodeURIComponent(id)}`;
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (tid) {
    return requestForTenant<{ deleted: true; id: string }>(tid, path, {
      method: 'DELETE',
    });
  }
  return request<{ deleted: true; id: string }>(path, { method: 'DELETE' });
}

/** Matches API `CreatePadelCourtDto` (optional fields omitted when unset). */
export type CreatePadelCourtBody = {
  businessLocationId: string;
  name: string;
  arenaLabel?: string;
  courtStatus?: 'active' | 'maintenance' | 'draft';
  description?: string;
  imageUrls?: string[];
  ceilingHeightValue?: number;
  ceilingHeightUnit?: 'ft' | 'm';
  coveredType?: 'indoor' | 'semi_covered';
  glassWalls?: boolean;
  wallType?: 'full_glass' | 'glass_mesh';
  lighting?: string;
  ventilation?: string;
  lengthM?: number;
  widthM?: number;
  surfaceType?: 'synthetic_turf' | 'acrylic';
  matchType?: 'singles' | 'doubles';
  maxPlayers?: number;
  pricePerSlot?: number;
  peakPricing?: { weekdayEvening?: number; weekend?: number };
  membershipPrice?: number;
  slotDurationMinutes?: 60;
  bufferBetweenSlotsMinutes?: number;
  extras?: {
    racketRental?: boolean;
    ballRental?: boolean;
    coachingAvailable?: boolean;
  };
  amenities?: {
    seating?: boolean;
    changingRoom?: boolean;
    parking?: boolean;
  };
  rules?: {
    maxPlayers?: number;
    gameRules?: string;
    cancellationPolicy?: string;
  };
  isActive?: boolean;
  timeSlotTemplateId?: string | null;
};

/** GET /arena/padel-court/:id — full record. */
export type PadelCourtDetail = Partial<CreatePadelCourtBody> & {
  id: string;
  name: string;
  tenantId?: string;
  businessLocationId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function getPadelCourt(id: string): Promise<PadelCourtDetail> {
  return request<PadelCourtDetail>(`/arena/padel-court/${id}`, {
    method: 'GET',
  });
}

export async function createPadelCourt(
  body: CreatePadelCourtBody,
): Promise<NamedCourt> {
  return request<NamedCourt>('/arena/padel-court', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type UpdatePadelCourtBody = Partial<
  Omit<CreatePadelCourtBody, 'businessLocationId'>
>;

export async function updatePadelCourt(
  id: string,
  body: UpdatePadelCourtBody,
): Promise<NamedCourt> {
  return request<NamedCourt>(`/arena/padel-court/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deletePadelCourt(
  id: string,
  tenantIdOverride?: string,
): Promise<{ deleted: true; id: string }> {
  const path = `/arena/padel-court/${id}`;
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (tid) {
    return requestForTenant<{ deleted: true; id: string }>(tid, path, {
      method: 'DELETE',
    });
  }
  return request<{ deleted: true; id: string }>(path, { method: 'DELETE' });
}

export type TimeSlotTemplateRecord = {
  id: string;
  name: string;
  slotLines?: Array<{
    id: string;
    startTime: string;
    endTime: string;
    status: 'available' | 'blocked';
    sortOrder: number;
  }>;
  slotStarts: string[];
  createdAt: string;
  updatedAt: string;
};

export async function listTimeSlotTemplates(
  tenantIdOverride?: string,
): Promise<TimeSlotTemplateRecord[]> {
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (!getToken() || !tid) return [];
  return requestForTenant<TimeSlotTemplateRecord[]>(
    tid,
    '/bookings/time-slot-templates',
    { method: 'GET' },
  );
}

export async function createTimeSlotTemplate(
  body: {
    name: string;
    slotStarts?: string[];
    slotLines?: Array<{
      startTime: string;
      endTime: string;
      status?: 'available' | 'blocked';
    }>;
  },
  tenantIdOverride?: string,
): Promise<TimeSlotTemplateRecord> {
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  return requestForTenant<TimeSlotTemplateRecord>(
    tid,
    '/bookings/time-slot-templates',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function updateTimeSlotTemplate(
  id: string,
  body: Partial<{
    name: string;
    slotStarts: string[];
    slotLines: Array<{
      startTime: string;
      endTime: string;
      status?: 'available' | 'blocked';
    }>;
  }>,
  tenantIdOverride?: string,
): Promise<TimeSlotTemplateRecord> {
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  return requestForTenant<TimeSlotTemplateRecord>(
    tid,
    `/bookings/time-slot-templates/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export async function deleteTimeSlotTemplate(
  id: string,
  tenantIdOverride?: string,
): Promise<{ deleted: true; id: string }> {
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  return requestForTenant<{ deleted: true; id: string }>(
    tid,
    `/bookings/time-slot-templates/${id}`,
    { method: 'DELETE' },
  );
}

/**
 * Bookable courts for the active tenant. When `businessLocationId` is set, only courts at that location.
 * When `sport` is omitted, returns padel, futsal, and cricket options together.
 * Pass `tenantIdOverride` when the UI has no global active tenant (e.g. platform owner on “all businesses”).
 */
export async function listCourtOptions(
  sport?: BookingSportType,
  businessLocationId?: string,
  tenantIdOverride?: string,
): Promise<CourtOption[]> {
  if (!getToken()) return [];
  const tid = (tenantIdOverride ?? getTenantId()).trim();
  if (!tid) return [];
  const loc = businessLocationId?.trim() || undefined;
  const padelPath =
    loc != null
      ? `/arena/padel-court?businessLocationId=${encodeURIComponent(loc)}`
      : '/arena/padel-court';
  const futsalPath = appendBusinessLocationQuery(ARENA_TURF_COURTS, loc, 'futsal');
  const cricketPath = appendBusinessLocationQuery(ARENA_TURF_COURTS, loc, 'cricket');
  try {
    const out: CourtOption[] = [];

    if (sport === undefined) {
      const [padelRows, futsalCourts, cricketCourts] = await Promise.all([
        requestForTenant<NamedCourt[]>(tid, padelPath, { method: 'GET' }),
        requestForTenant<NamedCourt[]>(tid, futsalPath, { method: 'GET' }),
        requestForTenant<NamedCourt[]>(tid, cricketPath, { method: 'GET' }),
      ]);
      for (const r of padelRows) {
        out.push({
          kind: 'padel_court',
          id: r.id,
          label: `Padel — ${r.name}`,
          businessLocationId: r.businessLocationId,
          timeSlotTemplateId: r.timeSlotTemplateId ?? null,
        });
      }
      const dualTurfIds = new Set(
        futsalCourts.filter((r) => r.supportsCricket === true).map((r) => r.id),
      );
      for (const r of futsalCourts) {
        if (r.supportsCricket === true) {
          out.push({
            kind: 'futsal_court',
            id: r.id,
            facilityKey: `shared-turf:${r.id}`,
            label: `Turf (futsal + cricket) — ${r.name}`,
            businessLocationId: r.businessLocationId,
            timeSlotTemplateId: r.timeSlotTemplateId ?? null,
          });
        } else {
          out.push({
            kind: 'futsal_court',
            id: r.id,
            label: `Futsal pitch — ${r.name}`,
            businessLocationId: r.businessLocationId,
            timeSlotTemplateId: r.timeSlotTemplateId ?? null,
          });
        }
      }
      for (const r of cricketCourts) {
        if (dualTurfIds.has(r.id)) continue;
        out.push({
          kind: 'cricket_court',
          id: r.id,
          label: `Cricket pitch — ${r.name}`,
          businessLocationId: r.businessLocationId,
          timeSlotTemplateId: r.timeSlotTemplateId ?? null,
        });
      }
      return out;
    }

    if (sport === 'padel') {
      const rows = await requestForTenant<NamedCourt[]>(tid, padelPath, { method: 'GET' });
      for (const r of rows) {
        out.push({
          kind: 'padel_court',
          id: r.id,
          label: `Padel — ${r.name}`,
          businessLocationId: r.businessLocationId,
          timeSlotTemplateId: r.timeSlotTemplateId ?? null,
        });
      }
    } else if (sport === 'futsal') {
      const courts = await requestForTenant<NamedCourt[]>(tid, futsalPath, { method: 'GET' });
      for (const r of courts) {
        out.push({
          kind: 'futsal_court',
          id: r.id,
          label:
            r.supportsCricket === true
              ? `Turf (futsal + cricket) — ${r.name}`
              : `Futsal pitch — ${r.name}`,
          businessLocationId: r.businessLocationId,
          timeSlotTemplateId: r.timeSlotTemplateId ?? null,
        });
      }
    } else {
      const courts = await requestForTenant<NamedCourt[]>(tid, cricketPath, { method: 'GET' });
      for (const r of courts) {
        out.push({
          kind: 'cricket_court',
          id: r.id,
          label: `Cricket pitch — ${r.name}`,
          businessLocationId: r.businessLocationId,
          timeSlotTemplateId: r.timeSlotTemplateId ?? null,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}
