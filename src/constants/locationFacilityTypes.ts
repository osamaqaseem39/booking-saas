/** Keep in sync with backend `business-location.constants.ts` (`BUSINESS_LOCATION_FACILITY_TYPE_CODES`). */

/** Route segment for combined turf setup (`/facilities/setup/turf-court`). */
export const TURF_COURT_SETUP_CODE = 'turf-court' as const;

export const LOCATION_FACILITY_TYPE_OPTIONS: { value: string; label: string }[] =
  [
    { value: 'turf-court', label: 'Turf' },
    { value: 'padel-court', label: 'Padel' },
  ];

export function isCourtSetupAllowedForLocation(
  location: { facilityTypes?: string[] } | undefined,
  facilityCode: string,
): boolean {
  if (!location) return false;
  const allowed = location.facilityTypes ?? [];
  if (allowed.length === 0) return true;
  if (facilityCode === TURF_COURT_SETUP_CODE) {
    return (
      allowed.includes('turf-court') ||
      allowed.includes('futsal-field') ||
      allowed.includes('cricket-indoor')
    );
  }
  return allowed.includes(facilityCode);
}

/** Setup entry points: Turf combined form, then Padel. */
export function courtSetupOptions(): { code: string; label: string }[] {
  return LOCATION_FACILITY_TYPE_OPTIONS.map((o) => ({
    code: o.value,
    label: o.label,
  }));
}

const LABEL_BY_CODE: Record<string, string> = {
  ...Object.fromEntries(
    LOCATION_FACILITY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
  ),
  'futsal-field': 'Futsal (legacy)',
  'cricket-indoor': 'Arena cricket (legacy)',
};

export function formatFacilityTypeLabel(code: string): string {
  return LABEL_BY_CODE[code] ?? code;
}
