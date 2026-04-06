/** Gaming-zone setup route codes; keep in sync with API `business-location.constants.ts`. */

export const GAMING_SETUP_CODES = [
  'gaming-pc',
  'gaming-ps5',
  'gaming-ps4',
  'gaming-xbox-one',
  'gaming-xbox-360',
  'gaming-vr',
  'gaming-steering-sim',
] as const;

export type GamingSetupCode = (typeof GAMING_SETUP_CODES)[number];

export const GAMING_SETUP_OPTIONS: { value: GamingSetupCode; label: string }[] = [
  { value: 'gaming-pc', label: 'PC' },
  { value: 'gaming-ps5', label: 'PS5' },
  { value: 'gaming-ps4', label: 'PS4' },
  { value: 'gaming-xbox-one', label: 'Xbox One' },
  { value: 'gaming-xbox-360', label: 'Xbox 360' },
  { value: 'gaming-vr', label: 'VR' },
  { value: 'gaming-steering-sim', label: 'Steering simulator' },
];

/** Consoles share one form layout; PC / VR / sim use their own forms. */
export const GAMING_CONSOLE_SETUP_CODES = [
  'gaming-ps5',
  'gaming-ps4',
  'gaming-xbox-one',
  'gaming-xbox-360',
] as const;

export type GamingConsoleSetupCode = (typeof GAMING_CONSOLE_SETUP_CODES)[number];

const SETUP_CODE_SET = new Set<string>(GAMING_SETUP_CODES);

export function isGamingSetupCode(code: string): code is GamingSetupCode {
  return SETUP_CODE_SET.has(code);
}

export function formatGamingSetupLabel(code: string): string {
  return GAMING_SETUP_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

export function isGamingConsoleSetupCode(
  code: string,
): code is GamingConsoleSetupCode {
  return (GAMING_CONSOLE_SETUP_CODES as readonly string[]).includes(code);
}

/** Location must be gaming-zone; empty facilityTypes = all gaming setups allowed. */
export function isGamingSetupAllowedForLocation(
  location:
    | { locationType?: string; facilityTypes?: string[] }
    | undefined,
  facilityCode: string,
): boolean {
  if (!location) return false;
  if ((location.locationType ?? '') !== 'gaming-zone') return false;
  if (!isGamingSetupCode(facilityCode)) return false;
  const allowed = location.facilityTypes ?? [];
  if (allowed.length === 0) return true;
  return allowed.includes(facilityCode);
}

export const GAMING_LOCATION_FACILITY_OPTIONS = GAMING_SETUP_OPTIONS;
