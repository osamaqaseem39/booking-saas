/** Keep in sync with backend `business-location.constants.ts` (`BUSINESS_LOCATION_FACILITY_TYPE_CODES`). */

/** Combined turf pitch setup route (`/facilities/setup/turf-court`), not a standalone facility type code. */
export const TURF_COURT_SETUP_CODE = 'turf-court' as const;

export const LOCATION_FACILITY_TYPE_OPTIONS: { value: string; label: string }[] =
  [
    { value: 'cricket-indoor', label: 'Arena Cricket' },
    { value: 'futsal-field', label: 'Futsal' },
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
      allowed.includes('futsal-field') || allowed.includes('cricket-indoor')
    );
  }
  return allowed.includes(facilityCode);
}

/** All setup forms: turf first, then location facility types. */
export function courtSetupOptions(): { code: string; label: string }[] {
  return [
    { code: TURF_COURT_SETUP_CODE, label: 'Turf court (Futsal + Cricket)' },
    ...LOCATION_FACILITY_TYPE_OPTIONS.map((o) => ({
      code: o.value,
      label: o.label,
    })),
  ];
}

const LABEL_BY_CODE: Record<string, string> = {
  ...Object.fromEntries(
    LOCATION_FACILITY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
  ),
  [TURF_COURT_SETUP_CODE]: 'Turf court',
};

export function formatFacilityTypeLabel(code: string): string {
  return LABEL_BY_CODE[code] ?? code;
}
