const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/i;

export function extractRemittanceCashierCode(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (CODE_RE.test(value)) return value.toUpperCase();

  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/rc\/([A-Za-z0-9]{8})\/?$/i);
    if (match && CODE_RE.test(match[1])) return match[1].toUpperCase();
  } catch {
    // Not a URL; fall through to the path matcher below.
  }

  const pathMatch = value.match(/(?:^|\/)rc\/([A-Za-z0-9]{8})(?:\/?(?:[?#].*)?$)/i);
  if (pathMatch && CODE_RE.test(pathMatch[1])) return pathMatch[1].toUpperCase();

  return null;
}
