/** Keep in sync with backend `business-location.constants.ts`. */

export const FUTSAL_COURT_SETUP_CODE = 'futsal-court' as const;
export const CRICKET_COURT_SETUP_CODE = 'cricket-court' as const;

/** @deprecated Use FUTSAL_COURT_SETUP_CODE */
export const TURF_COURT_SETUP_CODE = FUTSAL_COURT_SETUP_CODE;

export const LOCATION_FACILITY_TYPE_OPTIONS: { value: string; label: string }[] =
  [
    { value: 'futsal', label: 'Futsal' },
    { value: 'cricket', label: 'Cricket' },
    { value: 'padel', label: 'Padel' },
  ];

export function isCourtSetupAllowedForLocation(
  location: { facilityTypes?: string[] } | undefined,
  facilityCode: string,
): boolean {
  if (!location) return false;
  const allowed = location.facilityTypes ?? [];
  if (allowed.length === 0) return true;
  if (facilityCode === FUTSAL_COURT_SETUP_CODE) {
    return allowed.some(
      (c) =>
        c === 'futsal' ||
        c === 'futsal-field' ||
        c === 'turf-court-futsal' ||
        c === 'turf-court',
    );
  }
  if (facilityCode === CRICKET_COURT_SETUP_CODE) {
    return allowed.some(
      (c) =>
        c === 'cricket' ||
        c === 'cricket-indoor' ||
        c === 'turf-court-cricket' ||
        c === 'turf-court',
    );
  }
  if (facilityCode === 'padel-court') {
    return allowed.some((c) => c === 'padel' || c === 'padel-court');
  }
  return allowed.includes(facilityCode);
}

export function courtSetupOptions(): { code: string; label: string }[] {
  return [
    { code: FUTSAL_COURT_SETUP_CODE, label: 'Futsal pitch' },
    { code: CRICKET_COURT_SETUP_CODE, label: 'Cricket pitch' },
    { code: 'padel-court', label: 'Padel court' },
  ];
}

const LABEL_BY_CODE: Record<string, string> = {
  ...Object.fromEntries(
    LOCATION_FACILITY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
  ),
  'futsal-court': 'Futsal pitch',
  'cricket-court': 'Cricket pitch',
  'padel-court': 'Padel',
  futsal: 'Futsal',
  cricket: 'Cricket',
  padel: 'Padel',
  'turf-court': 'Turf (legacy)',
  'turf-court-futsal': 'Turf — Futsal (legacy)',
  'turf-court-cricket': 'Turf — Cricket (legacy)',
  'futsal-field': 'Futsal (legacy field)',
  'cricket-indoor': 'Cricket indoor (legacy)',
  turf: 'Turf (futsal + cricket)',
};

export function formatFacilityTypeLabel(code: string): string {
  return LABEL_BY_CODE[code] ?? code;
}
