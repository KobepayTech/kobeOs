/** Exact media keys from public URLs. Ignore query strings and tracking paths. */
export function socialPostKey(platform: string, raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return '';
    const host = url.hostname.replace(/^www\./, '');
    if (platform === 'instagram' && host === 'instagram.com') {
      return url.pathname.match(/^\/(?:p|reel|reels|tv)\/([\w-]+)\/?$/)?.[1] || '';
    }
    if (platform === 'tiktok' && host === 'tiktok.com') {
      return url.pathname.match(/^\/@[\w.]+\/(?:video|photo)\/(\d+)\/?$/)?.[1] || '';
    }
  } catch { /* invalid or unsupported URL */ }
  return '';
}

export function socialSaleIntent(raw: string) {
  const text = raw.toLowerCase();
  const swahili = /\b(?:bei|shilingi|ngapi|gani|nataka|nahitaji|ninataka|naomba|nunua|nitanunua|nachukua|nitalipaje|malipo|nitalipa|peleka|usafirishaji|kuchukua|moja|mbili|tatu|ipo|zipo)\b/.test(text);
  const price = /\b(?:how much|price|cost|bei|shilingi ngapi|ngapi|available|availability|in stock|ipo|zipo)\b/.test(text);
  const checkout = /\b(?:payment|how (?:do|can) i pay|how to pay|how (?:do|can|to) (?:i )?buy|pay|deliver(?:y)?|pick[ -]?up|ship|shipping|malipo|nitalipaje|nitalipa|usafirishaji|peleka|kuchukua)\b/.test(text);
  const declined = /\b(?:don['’]t|do not|not buying|sitaki|sinunui)\b/.test(text);
  const buy = /\b(?:buy|i want (?:one|two|three|\d+|it|this|to buy)|i['’]ll take|order (?:one|two|three|\d+|this|it)|nataka|ninataka|nahitaji|nitanunua|nachukua|nunua|naomba (?:moja|mbili|tatu|\d+))\b/.test(text)
    && !declined;
  const quantity = text.match(/\b(?:want|take|order|nataka|ninataka|nahitaji|nachukua|naomba|buy|nunua)\s+(\d{1,3}|one|two|three|moja|mbili|tatu)\b/)?.[1] || '';
  const words: Record<string, number> = { one: 1, two: 2, three: 3, moja: 1, mbili: 2, tatu: 3 };
  return { price, checkout, buy, declined, swahili, quantity: Math.max(1, words[quantity] || Number(quantity) || 1) };
}
