/**
 * Display-only: convert API / storage time (24-hour HH:mm) to 12-hour for the UI.
 * Always send HH:mm (24h) to the backend unchanged.
 */
export function formatTime12h(time24: string): string {
  const t = (time24 ?? '').trim();
  if (!t) return '—';
  if (t === '24:00') return '12:00 AM';
  const [hRaw, mRaw] = t.split(':');
  const h = Number(hRaw ?? 0);
  const m = Number(mRaw ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatTimeRange12h(start24: string, end24: string): string {
  return `${formatTime12h(start24)} – ${formatTime12h(end24)}`;
}
