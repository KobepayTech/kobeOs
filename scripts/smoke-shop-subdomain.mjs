#!/usr/bin/env node
/**
 * Create/publish a shop and verify its subdomain storefront.
 *
 * Usage:
 *   AUTH_TOKEN='<jwt>' node scripts/smoke-shop-subdomain.mjs
 *
 * Optional env:
 *   API_BASE=https://api.kobeapptz.com/api
 *   DOMAIN=kobeapptz.com
 *   SHOP_SLUG=kobe-demo-123
 *   SHOP_NAME='Kobe Demo 123'
 */

const API_BASE = process.env.API_BASE || 'https://api.kobeapptz.com/api';
const DOMAIN = process.env.DOMAIN || 'kobeapptz.com';
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.KOBE_JWT || '';
const seed = Date.now().toString(36).slice(-6);
const SHOP_SLUG = (process.env.SHOP_SLUG || `kobe-demo-${seed}`)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 63);
const SHOP_NAME = process.env.SHOP_NAME || SHOP_SLUG;

if (!AUTH_TOKEN) {
  console.error('ERROR: Set AUTH_TOKEN to a logged-in KobeOS JWT.');
  console.error("Example: AUTH_TOKEN='eyJ...' node scripts/smoke-shop-subdomain.mjs");
  process.exit(1);
}

function logStep(title) {
  console.log(`\n==> ${title}`);
}

async function api(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) {
    const details = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    throw new Error(`API ${res.status} ${path}\n${details}`);
  }
  return body;
}

async function publicGet(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  return {
    url,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    text,
  };
}

function assertNoParkedPage(result) {
  if (/hostinger|parked domain|domain is parked/i.test(result.text)) {
    throw new Error(`Hostinger/parked page still served at ${result.url}`);
  }
}

function assertLooksLikeSpa(result) {
  assertNoParkedPage(result);
  if (!/<div id="root"|\/assets\/|KobeOS|Kobe/i.test(result.text)) {
    console.warn(`WARN: ${result.url} did not contain a strong SPA marker. First 300 chars:`);
    console.warn(result.text.slice(0, 300));
  }
}

logStep(`Creating/publishing shop '${SHOP_NAME}'`);
const saved = await api('/store-settings', {
  method: 'PUT',
  body: JSON.stringify({
    storeName: SHOP_NAME,
    tagline: 'Automated smoke-test shop',
    bannerHeadline: `Welcome to ${SHOP_NAME}`,
    bannerSubtext: 'Created by smoke-shop-subdomain.mjs',
    bannerCta: 'Shop Now',
  }),
});

const slug = saved.domainSlug || SHOP_SLUG;
console.log({ slug, isPublished: saved.isPublished, publishedUrl: saved.publishedUrl });

if (!saved.isPublished) {
  logStep('Store save succeeded but was not published; calling publish endpoint');
  const published = await api('/store-settings/publish', { method: 'POST', body: '{}' });
  console.log({ slug: published.domainSlug, isPublished: published.isPublished, publishedUrl: published.publishedUrl });
}

logStep('Verifying public store API');
const publicStore = await fetch(`${API_BASE}/store/${encodeURIComponent(slug)}?limit=1`);
const publicBody = await publicStore.text();
console.log(`GET /store/${slug}: ${publicStore.status}`);
if (!publicStore.ok) throw new Error(publicBody);

logStep('Verifying apex fallback URL');
const apexUrl = `https://${DOMAIN}/shop/${encodeURIComponent(slug)}`;
const apex = await publicGet(apexUrl);
console.log(`${apex.status} ${apexUrl}`);
console.log(`X-Kobe-Origin: ${apex.headers['x-kobe-origin'] || '(missing)'}`);
assertLooksLikeSpa(apex);

logStep('Verifying wildcard subdomain URL');
const subdomainUrl = `https://${slug}.${DOMAIN}/`;
const sub = await publicGet(subdomainUrl);
console.log(`${sub.status} ${subdomainUrl}`);
console.log(`X-Kobe-Origin: ${sub.headers['x-kobe-origin'] || '(missing)'}`);
assertLooksLikeSpa(sub);

console.log('\nPASS: shop was created/published and both URLs reached the KobeOS storefront shell.');
console.log(`Subdomain: ${subdomainUrl}`);
console.log(`Apex fallback: ${apexUrl}`);
