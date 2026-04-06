import type { SystemRole } from './types/domain';

export type NavRole = SystemRole | 'authenticated';

export interface NavItem {
  to: string;
  label: string;
  /** Any of these roles grants access. 'authenticated' = signed-in with at least one role from /iam/me */
  anyOf: NavRole[];
  /** If true, hide this nav link for the given role set (e.g. business admins). */
  hideWhen?: (userRoles: string[]) => boolean;
}

/** Shown after all other links for business admins (not platform owners). */
const BUSINESS_ADMIN_NAV_BOTTOM = new Set([
  '/app/locations',
  '/app/Facilites',
  '/app/users',
]);

export const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Overview', anyOf: ['authenticated'] },
  {
    to: '/app/businesses',
    label: 'Businesses & tenants',
    anyOf: ['platform-owner'],
  },
  {
    to: '/app/locations',
    label: 'Locations',
    anyOf: ['platform-owner', 'business-admin', 'customer-end-user'],
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
    to: '/app/bookings/new',
    label: 'Add booking',
    anyOf: [
      'platform-owner',
      'business-admin',
      'business-staff',
      'customer-end-user',
    ],
  },
  {
    to: '/app/facilities-live',
    label: 'Facilities live',
    anyOf: ['platform-owner', 'business-admin'],
  },
  {
    to: '/app/billing',
    label: 'Billing',
    anyOf: ['platform-owner', 'business-admin', 'business-staff'],
  },
  {
    to: '/app/health',
    label: 'API health',
    anyOf: ['authenticated'],
    hideWhen: (roles) =>
      roles.includes('business-admin') && !roles.includes('platform-owner'),
  },
];

export function rolesForNav(userRoles: string[]): NavRole[] {
  const r = new Set<NavRole>(userRoles as NavRole[]);
  if (userRoles.length > 0) r.add('authenticated');
  return [...r];
}

function dedupeNavByTo(items: NavItem[]): NavItem[] {
  return items.filter(
    (item, index, arr) => arr.findIndex((x) => x.to === item.to) === index,
  );
}

/** Main nav plus optional footer (e.g. business admin: locations / facilities / users at bottom). */
export function navSectionsForRoles(userRoles: string[]): {
  main: NavItem[];
  footer: NavItem[];
} {
  const expanded = rolesForNav(userRoles);
  const filtered = dedupeNavByTo(
    NAV_ITEMS.filter((item) => {
      if (item.hideWhen?.(userRoles)) return false;
      return item.anyOf.some((need) => expanded.includes(need));
    }),
  );
  const businessAdminOnly =
    userRoles.includes('business-admin') &&
    !userRoles.includes('platform-owner');
  if (!businessAdminOnly) {
    return { main: filtered, footer: [] };
  }
  const main: NavItem[] = [];
  const footer: NavItem[] = [];
  for (const item of filtered) {
    if (BUSINESS_ADMIN_NAV_BOTTOM.has(item.to)) footer.push(item);
    else main.push(item);
  }
  return { main, footer };
}

export function navVisibleForRoles(userRoles: string[]): NavItem[] {
  const { main, footer } = navSectionsForRoles(userRoles);
  return [...main, ...footer];
}

export function userMayAssignRoles(userRoles: string[]): boolean {
  return userRoles.includes('platform-owner');
}
