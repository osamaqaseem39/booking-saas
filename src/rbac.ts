import type { SystemRole } from './types/domain';

export type NavRole = SystemRole | 'authenticated';

export interface NavItem {
  to: string;
  label: string;
  /** Any of these roles grants access. 'authenticated' = signed-in with at least one role from /iam/me */
  anyOf: NavRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Overview', anyOf: ['authenticated'] },
  {
    to: '/app/businesses',
    label: 'Businesses & tenants',
    anyOf: ['platform-owner', 'business-admin'],
  },
  {
    to: '/app/locations',
    label: 'Locations',
    anyOf: ['platform-owner', 'business-admin'],
  },
  {
    to: '/app/Facilites',
    label: 'Facilities',
    anyOf: ['platform-owner', 'business-admin'],
  },
  {
    to: '/app/end-users',
    label: 'Customers',
    anyOf: ['platform-owner'],
  },
  {
    to: '/app/users',
    label: 'Business users',
    anyOf: ['platform-owner', 'business-admin'],
  },
  {
    to: '/app/bookings',
    label: 'Bookings',
    anyOf: [
      'platform-owner',
      'business-admin',
      'business-staff',
      'customer-end-user',
    ],
  },
  {
    to: '/app/billing',
    label: 'Billing',
    anyOf: ['platform-owner', 'business-admin', 'business-staff'],
  },
  { to: '/app/health', label: 'API health', anyOf: ['authenticated'] },
];

export function rolesForNav(userRoles: string[]): NavRole[] {
  const r = new Set<NavRole>(userRoles as NavRole[]);
  if (userRoles.length > 0) r.add('authenticated');
  return [...r];
}

export function navVisibleForRoles(userRoles: string[]): NavItem[] {
  const expanded = rolesForNav(userRoles);
  return NAV_ITEMS.filter((item) =>
    item.anyOf.some((need) => expanded.includes(need)),
  );
}

export function userMayAssignRoles(userRoles: string[]): boolean {
  return userRoles.includes('platform-owner');
}
