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

export function persistConnection(opts: {
  apiBase: string;
  tenantId: string;
  token: string;
}): void {
  // Defensive: sometimes API responses / state updates can introduce `undefined`
  // at runtime even if TypeScript types say `string`.
  const apiBase = (opts.apiBase ?? '').toString().trim().replace(/\/$/, '');
  const tenantId = (opts.tenantId ?? '').toString().trim();
  const token = (opts.token ?? '').toString().trim();

  localStorage.setItem(LS_API, apiBase);
  localStorage.setItem(LS_TENANT, tenantId);
  localStorage.setItem(LS_TOKEN, token);
}

export function setTenantIdStorage(tenantId: string): void {
  localStorage.setItem(LS_TENANT, (tenantId ?? '').toString().trim());
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

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...headers(!(init.body instanceof FormData)),
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return undefined as T;
  return res.json() as Promise<T>;
}

export async function requestForTenant<T>(
  tenantId: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...headersForTenant(tenantId, !(init.body instanceof FormData)),
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return undefined as T;
  return res.json() as Promise<T>;
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
  locationType: string;
  facilityTypes?: string[];
  name: string;
  addressLine?: string;
  city?: string;
  phone?: string;
}): Promise<unknown> {
  return request('/businesses/locations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateBusinessLocation(
  locationId: string,
  body: {
    locationType?: string;
    facilityTypes?: string[];
    name?: string;
    addressLine?: string;
    city?: string;
    phone?: string;
    isActive?: boolean;
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
  businessName: string;
  legalName?: string;
  vertical: string;
  admin: { fullName: string; email: string; phone?: string; password: string };
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
    vertical?: string;
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

export async function createTurfCourt(body: {
  businessLocationId: string;
  name: string;
  sportMode: 'futsal_only' | 'cricket_only' | 'both';
}): Promise<NamedCourt> {
  return request<NamedCourt>('/arena/turf-courts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateTurfCourt(
  id: string,
  body: { name?: string; sportMode?: 'futsal_only' | 'cricket_only' | 'both' },
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
