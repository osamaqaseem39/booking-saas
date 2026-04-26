/** Keep in sync with backend `business-location.constants.ts`. */

export const FUTSAL_COURT_SETUP_CODE = 'futsal-court' as const;
export const CRICKET_COURT_SETUP_CODE = 'cricket-court' as const;
export const TABLE_TENNIS_COURT_SETUP_CODE = 'table-tennis-court' as const;

/** @deprecated Use FUTSAL_COURT_SETUP_CODE */
export const TURF_COURT_SETUP_CODE = FUTSAL_COURT_SETUP_CODE;

export const LOCATION_FACILITY_TYPE_OPTIONS: { value: string; label: string }[] =
  [
    { value: 'turf', label: 'Turf' },
    { value: 'padel', label: 'Padel' },
    { value: 'table-tennis', label: 'Table tennis' },
  ];

/** Collapse legacy arena facility tags into current toggle values. */
export function normalizeLocationFacilityTypesSelection(
  raw: string[] | null | undefined,
): string[] {
  if (!raw?.length) return [];
  const out = new Set<string>();
  for (const t of raw) {
    if (
      t === 'turf' ||
      t === 'futsal' ||
      t === 'cricket' ||
      t === 'futsal-field' ||
      t === 'cricket-indoor' ||
      t === 'turf-court' ||
      t === 'turf-court-futsal' ||
      t === 'turf-court-cricket'
    ) {
      out.add('turf');
      continue;
    }
    if (t === 'padel' || t === 'padel-court') {
      out.add('padel');
      continue;
    }
    if (
      t === 'table-tennis' ||
      t === 'table-tennis-court' ||
      t === 'table-tennis-table'
    ) {
      out.add('table-tennis');
      continue;
    }
    out.add(t);
  }
  return [...out];
}

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
        c === 'turf' ||
        c === 'futsal-field' ||
        c === 'turf-court-futsal' ||
        c === 'turf-court',
    );
  }
  if (facilityCode === CRICKET_COURT_SETUP_CODE) {
    return allowed.some(
      (c) =>
        c === 'cricket' ||
        c === 'turf' ||
        c === 'cricket-indoor' ||
        c === 'turf-court-cricket' ||
        c === 'turf-court',
    );
  }
  if (facilityCode === 'padel-court') {
    return allowed.some((c) => c === 'padel' || c === 'padel-court');
  }
  if (facilityCode === TABLE_TENNIS_COURT_SETUP_CODE) {
    return allowed.some(
      (c) =>
        c === 'table-tennis' ||
        c === 'table-tennis-court' ||
        c === 'table-tennis-table',
    );
  }
  return allowed.includes(facilityCode);
}

export function courtSetupOptions(): { code: string; label: string }[] {
  return [
    { code: FUTSAL_COURT_SETUP_CODE, label: 'Futsal pitch' },
    { code: CRICKET_COURT_SETUP_CODE, label: 'Cricket pitch' },
    { code: 'padel-court', label: 'Padel court' },
    { code: TABLE_TENNIS_COURT_SETUP_CODE, label: 'Table tennis table' },
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
  'table-tennis': 'Table tennis',
  'table-tennis-court': 'Table tennis',
  'table-tennis-table': 'Table tennis',
};

export function formatFacilityTypeLabel(code: string): string {
  return LABEL_BY_CODE[code] ?? code;
}
