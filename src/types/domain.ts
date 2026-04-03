export type SystemRole =
  | 'platform-owner'
  | 'business-admin'
  | 'business-staff'
  | 'customer-end-user';

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  roles: string[];
}

export interface BusinessMembershipRow {
  id: string;
  businessId: string;
  userId: string;
  membershipRole: string;
  createdAt?: string;
}

export interface BusinessRow {
  id: string;
  tenantId: string;
  businessName: string;
  legalName?: string | null;
  businessType?: string | null;
  sportsOffered?: string[] | null;
  owner?: { name?: string; email?: string; phone?: string } | null;
  subscription?:
    | { plan?: string; status?: string; billingCycle?: string }
    | null;
  settings?:
    | { timezone?: string; currency?: string; allowOnlinePayments?: boolean }
    | null;
  status?: string | null;
  createdAt?: string;
  memberships: BusinessMembershipRow[];
}

export interface BusinessLocationRow {
  id: string;
  businessId: string;
  /** Kind of site (arena, branch, …) — set on each location. */
  locationType?: string;
  /** Court / sub-facility kinds this location hosts (e.g. padel-court). */
  facilityTypes?: string[];
  /** Counts of active bookable courts/fields at this location (from API lists). */
  facilityCounts?: {
    'padel-court': number;
    'futsal-field': number;
    'cricket-indoor': number;
    'turf-court': number;
  };
  /** Active courts/fields with id and display name. */
  facilityCourts?: Array<{
    facilityType:
      | 'padel-court'
      | 'futsal-field'
      | 'cricket-indoor'
      | 'turf-court';
    id: string;
    name: string;
  }>;
  name: string;
  addressLine?: string | null;
  /** Long-form description / notes for the location. */
  details?: string | null;
  city?: string | null;
  area?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  manager?: string | null;
  workingHours?: Record<string, unknown> | null;
  timezone?: string | null;
  currency?: string | null;
  logo?: string | null;
  bannerImage?: string | null;
  gallery?: string[];
  status?: string | null;
  /** Derived from `status` on the server; use `status` when updating. */
  isActive: boolean;
  createdAt: string;
  business: {
    id: string;
    businessName: string;
    tenantId: string;
  } | null;
}

export interface IamUserRow {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  createdAt?: string;
  roles?: string[];
}

export interface InvoiceRow {
  id: string;
  tenantId: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: string;
}

export interface NamedCourt {
  id: string;
  name: string;
  tenantId?: string;
  businessLocationId?: string | null;
  /** Facility-level lifecycle status where available (e.g. active, maintenance). */
  courtStatus?: string;
  /** Facility active flag where available. */
  isActive?: boolean;
}

export interface BusinessDashboardBusinessRow {
  businessId: string;
  tenantId?: string;
  businessName: string;
  status?: string | null;
  locationCount: number;
  courtCount: number;
  bookingCount: number;
  confirmedBookingCount: number;
  pendingBookingCount: number;
  cancelledBookingCount: number;
  revenueTotal: number;
  revenuePaid: number;
}

export interface BusinessDashboardView {
  generatedAt: string;
  scope: {
    businessCount: number;
    locationCount: number;
  };
  totals: {
    courtCount: number;
    bookingCount: number;
    confirmedBookingCount: number;
    pendingBookingCount: number;
    cancelledBookingCount: number;
    revenueTotal: number;
    revenuePaid: number;
  };
  businesses: BusinessDashboardBusinessRow[];
}

