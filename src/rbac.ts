import type { SystemRole } from './types/domain';

export type NavRole = SystemRole | 'authenticated';

export interface NavSubItem {
  to: string;
  label: string;
}

export interface NavItem {
  to: string;
  label: string;
  /** Any of these roles grants access. 'authenticated' = signed-in with at least one role from /iam/me */
  anyOf: NavRole[];
  /** If true, hide this nav link for the given role set (e.g. business admins). */
  hideWhen?: (userRoles: string[]) => boolean;
  /** Platform-owner: nested links (e.g. Locations / Facilities under Business). */
  children?: NavSubItem[];
}

/**
 * Shown in the sidebar footer for business admins (not platform owners).
 * Order is display order (venue setup, then team).
 */
const BUSINESS_ADMIN_FOOTER_ORDER = [
  '/app/locations',
  '/app/Facilites',
  '/app/time-slots',
  '/app/users',
] as const;

const BUSINESS_ADMIN_FOOTER_SET = new Set<string>(BUSINESS_ADMIN_FOOTER_ORDER);

function businessAdminFooterSortKey(to: string): number {
  const i = (BUSINESS_ADMIN_FOOTER_ORDER as readonly string[]).indexOf(to);
  return i === -1 ? 999 : i;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Overview', anyOf: ['authenticated'] },
  {
    to: '/app/businesses',
    label: 'Business',
    anyOf: ['platform-owner'],
  },
  {
    to: '/app/users',
    label: 'Users',
    anyOf: ['platform-owner', 'business-admin'],
  },
  {
    to: '/app/locations',
    label: 'Locations',
    anyOf: ['business-admin'],
  },
  {
    to: '/app/Facilites',
    label: 'Facilities',
    anyOf: ['business-admin'],
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
    to: '/app/time-slots',
    label: 'Manage booking slots',
    anyOf: ['platform-owner', 'business-admin', 'business-staff'],
  },
  {
    to: '/app/facilities-live',
    label: 'Facilities live',
    anyOf: ['business-admin'],
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

/** Main nav plus optional footer (business admin: locations, facilities, daily slots, users). */
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
    if (BUSINESS_ADMIN_FOOTER_SET.has(item.to)) footer.push(item);
    else main.push(item);
  }
  footer.sort((a, b) => businessAdminFooterSortKey(a.to) - businessAdminFooterSortKey(b.to));
  return { main, footer };
}

export function navVisibleForRoles(userRoles: string[]): NavItem[] {
  const { main, footer } = navSectionsForRoles(userRoles);
  return [...main, ...footer];
}

export function userMayAssignRoles(userRoles: string[]): boolean {
  return (
    userRoles.includes('platform-owner') || userRoles.includes('business-admin')
  );
}
