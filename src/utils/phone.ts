function splitExtension(raw: string): { main: string; ext?: string } {
  const m = raw.match(/^(.*?)(?:\s*(?:ext\.?|x|#)\s*(\d{1,10}))?$/i);
  const main = (m?.[1] ?? raw).trim();
  const ext = (m?.[2] ?? '').trim();
  return ext ? { main, ext } : { main };
}

function normalizeMainPhone(main: string): string {
  let cleaned = main.replace(/[^\d+]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }

  return cleaned.replace(/\D/g, '');
}

/** Stores phones in one normalized format, with optional extension as " xNNN". */
export function normalizePhoneForStorage(raw: string | null | undefined): string {
  const input = (raw ?? '').trim();
  if (!input) return '';
  const { main, ext } = splitExtension(input);
  const normalizedMain = normalizeMainPhone(main);
  if (!normalizedMain) return '';
  return ext ? `${normalizedMain} x${ext}` : normalizedMain;
}
