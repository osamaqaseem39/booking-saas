/** Fraction digits for latitude/longitude in forms and API payloads. */
export const COORDINATE_DECIMAL_PLACES = 14;

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/** API decimals often arrive as strings — coerce before calling `Number#toFixed`. */
export function formatCoordinateForInput(value: number | string | null | undefined): string {
  const n = toFiniteNumber(value);
  if (n === null) return '';
  return n.toFixed(COORDINATE_DECIMAL_PLACES);
}

/** Normalizes a finite coordinate to 14 fractional digits (IEEE double limits still apply). */
export function normalizeCoordinate(value: number): number {
  const n = toFiniteNumber(value);
  if (n === null) return NaN;
  return parseFloat(n.toFixed(COORDINATE_DECIMAL_PLACES));
}
