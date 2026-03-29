/** Keep in sync with backend `business-location.constants.ts` (`BUSINESS_LOCATION_FACILITY_TYPE_CODES`). */

export const LOCATION_FACILITY_TYPE_OPTIONS: { value: string; label: string }[] =
  [
    { value: 'turf-court', label: 'Turf (futsal / cricket)' },
    { value: 'cricket-indoor', label: 'Cricket indoor' },
    { value: 'futsal-field', label: 'Futsal field' },
    { value: 'padel-court', label: 'Padel court' },
  ];
