import { chromium } from '@playwright/test';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots');
fs.mkdirSync(outDir, { recursive: true });

const HMAC_SECRET = 'kobe-license-secret-change-in-prod';
const payload = {
  userId: 'qr-tester', plan: 'pro',
  issuedAt: Date.now(), expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
};
const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url');
const token = `${b64}.${sig}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

// Mock store-settings so the editor renders a "Published" state and
// the Mobile QR button is enabled.
await page.route('http://localhost:3000/api/store-settings', (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({
    storeName: 'Pro Jersey Shop',
    tagline: 'Official jerseys for the 2026 World Cup',
    domainSlug: 'projerseyshop',
    isPublished: true,
    publishedUrl: 'https://projerseyshop.kobeapptz.com',
    publishedAt: new Date().toISOString(),
    bannerHeadline: 'Upgrade your jersey',
    bannerSubtext: 'Free shipping over $50',
    bannerCta: 'Shop now',
    bannerVisible: true,
    primaryColor: '#1f2937',
    accentColor: '#10b981',
    gridColumns: 4,
    productsPerPage: 12,
    showStock: true,
    showCategoryBadge: true,
    showQuickAdd: true,
    bgStyle: 'dark', cardStyle: 'glass', headerStyle: 'centered',
    showSearch: true, showCategoryNav: true, showCartIcon: true,
    enableCategoryNav: true, headingSize: 'medium', bodySize: 'medium',
    productCardStyle: 'standard', bannerBg: 'from-blue-600 to-purple-700', bannerHeight: 'medium',
    logoUrl: '', faviconUrl: '', footerText: '', customDomain: null,
    jerseyConfig: {},
  }),
}));
await page.route('http://localhost:3000/api/store-settings/cloudflared-status', (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ installed: true, source: 'bundled', path: '/bundled', deploymentMode: 'hosted' }),
}));
await page.route('http://localhost:3000/api/store-settings/tunnel-status', (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ running: true }),
}));

await page.addInitScript(([t]) => {
  localStorage.setItem('kobeos_user', 'QR Tester');
  localStorage.setItem('kobe_license_token', t);
}, [token]);

await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: /ERP/i }).first().click();
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const win = document.querySelector('.rounded-3xl.border-white\\/50');
  if (win) Object.assign(win.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});
await page.locator('button:has-text("Store Editor")').first().click();
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const wins = document.querySelectorAll('.rounded-3xl.border-white\\/50');
  const top = wins[wins.length - 1];
  if (top) Object.assign(top.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});

await page.screenshot({ path: path.join(outDir, 'store-editor-state.png'), fullPage: false });

// Open the Domain & Publish section (it's defaultOpen but the scroll
// might hide it on small viewport). Find the Mobile QR button by
// scrolling the editor sidebar.
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const qr = btns.find((b) => b.textContent?.includes('Mobile QR'));
  if (qr) qr.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(400);

// Click the new "Mobile QR" button.
const qrBtn = page.locator('button:has-text("Mobile QR")').first();
const found = await qrBtn.count();
console.log(`Mobile QR button count: ${found}`);
if (found > 0) {
  await qrBtn.click({ timeout: 8000 });
  await page.waitForTimeout(800);
}
await page.screenshot({ path: path.join(outDir, 'store-mobile-qr.png'), fullPage: false });
console.log('Saved store-mobile-qr.png');

await browser.close();
