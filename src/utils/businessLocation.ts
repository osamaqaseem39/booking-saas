import type { BusinessLocationRow } from '../types/domain';

/** Match list row to URL param (handles string coercion and UUID casing). */
export function findBusinessLocationByRouteId(
  rows: BusinessLocationRow[],
  routeLocationId: string,
): BusinessLocationRow | null {
  const want = (routeLocationId ?? '').trim().toLowerCase();
  if (!want) return null;
  return (
    rows.find((r) => String(r.id).trim().toLowerCase() === want) ?? null
  );
}
