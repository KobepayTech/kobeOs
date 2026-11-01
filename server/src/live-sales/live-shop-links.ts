export function liveShopLinks(store: { domainSlug: string; customDomain?: string | null; publishedUrl?: string | null }, env: NodeJS.ProcessEnv = process.env) {
  if (env.KOBEOS_DEPLOYMENT === 'cloudflare-container' && !store.customDomain) {
    const base = (env.APP_FRONTEND_URL || 'https://kobeos-app.pages.dev').replace(/\/+$/, '');
    const storefrontUrl = `${base}/shop/${encodeURIComponent(store.domainSlug)}`;
    return { storefrontUrl, catalogUrl: store.domainSlug.length <= 40 ? `${base}/@${encodeURIComponent(store.domainSlug)}` : storefrontUrl };
  }
  const configured = store.customDomain?.trim() || store.publishedUrl?.trim();
  const storefrontUrl = (configured ? (/^https?:\/\//i.test(configured) ? configured : `https://${configured}`) : `https://${store.domainSlug}.${env.TENANT_BASE_DOMAIN || env.CF_DOMAIN || 'kobeapptz.com'}`).replace(/\/$/, '');
  return { storefrontUrl, catalogUrl: `${storefrontUrl}/live` };
}
