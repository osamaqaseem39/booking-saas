/** Fraction digits for latitude/longitude in forms and API payloads. */
export const COORDINATE_DECIMAL_PLACES = 14;

export function formatCoordinateForInput(value: number): string {
  return value.toFixed(COORDINATE_DECIMAL_PLACES);
}

/** Normalizes a finite coordinate to 14 fractional digits (IEEE double limits still apply). */
export function normalizeCoordinate(value: number): number {
  return parseFloat(value.toFixed(COORDINATE_DECIMAL_PLACES));
}
