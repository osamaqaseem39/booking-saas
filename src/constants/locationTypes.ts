/** Keep in sync with backend `business-location.constants.ts` suggestions. */
export const LOCATION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'arena', label: 'Arena' },
  { value: 'gaming-zone', label: 'Gaming Zone' },
  { value: 'snooker', label: 'Snooker (Coming Soon)' },
  { value: 'table-tennis', label: 'Table Tennis (Coming Soon)' },
];

/** Display label for a stored `locationType` (preset or custom string). */
export function formatLocationTypeLabel(typeKey: string): string {
  const t = typeKey.trim();
  if (!t) return '—';
  const preset = LOCATION_TYPE_OPTIONS.find((o) => o.value === t);
  if (preset) return preset.label;
  return t;
}
