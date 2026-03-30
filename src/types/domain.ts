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
  branchId?: string | null;
  arenaId?: string | null;
  /** Kind of site (arena, branch, …) — set on each location. */
  locationType?: string;
  /** Court / sub-facility kinds this location hosts (e.g. padel-court). */
  facilityTypes?: string[];
  name: string;
  addressLine?: string | null;
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
  status?: string | null;
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
}

