/** Keep in sync with backend `business-location.constants.ts` (`BUSINESS_LOCATION_FACILITY_TYPE_CODES`). */

export const LOCATION_FACILITY_TYPE_OPTIONS: { value: string; label: string }[] =
  [
    { value: 'cricket-indoor', label: 'Arena Cricket' },
    { value: 'futsal-field', label: 'Futsal' },
    { value: 'padel-court', label: 'Padel' },
  ];

const LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  LOCATION_FACILITY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export function formatFacilityTypeLabel(code: string): string {
  return LABEL_BY_CODE[code] ?? code;
}
