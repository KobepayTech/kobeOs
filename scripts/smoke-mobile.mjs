import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots/mobile');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const phone = devices['iPhone 14 Pro'];
const ctx = await browser.newContext({ ...phone });
const page = await ctx.newPage();

// Make sure the desktop-OS auth gate (kobeos_user in localStorage) does
// NOT carry over, otherwise App.tsx renders the desktop branch instead
// of the public /m route we want to snapshot.
await page.addInitScript(() => {
  try { localStorage.removeItem('kobeos_user'); } catch { /* private mode */ }
});

// Mock the auth-probe + list endpoints so the snapshot reaches the
// signed-in screens instead of bouncing back to the sign-in form.
// Catch every request to the backend host so the page never hits a real
// network. Returns a sensible default per endpoint; falls back to {} so
// nothing throws unexpectedly.
const apiHandler = (route) => {
  const fullUrl = route.request().url();
  // Strip the protocol+host+/api prefix and any query string.
  const path = fullUrl
    .replace(/^https?:\/\/[^/]+\/api/, '')
    .split('?')[0];
  const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/users/me') return json({ id: 'demo', email: 'demo@kobeos.test', displayName: 'Demo' });
  if (path === '/auth/refresh' || path === '/auth/login' || path === '/auth/register') {
    return json({ accessToken: 'demo', refreshToken: 'demo', user: { id: 'demo', email: 'demo@kobeos.test', displayName: 'Demo' } });
  }
  if (path === '/pos/products') {
    return json([
      { id: 'p1', sku: 'JR-001', name: 'Real Madrid Home Jersey 25/26', category: 'Jersey', price: 45000, stock: 12 },
      { id: 'p2', sku: 'JR-002', name: 'Barcelona Away Jersey 25/26', category: 'Jersey', price: 42000, stock: 4 },
      { id: 'p3', sku: 'JR-003', name: 'Man Utd Home Jersey 25/26', category: 'Jersey', price: 48000, stock: 0 },
      { id: 'p4', sku: 'BOOT-01', name: 'Adidas Predator Boots', category: 'Boots', price: 120000, stock: 8 },
      { id: 'p5', sku: 'BAG-01', name: 'Sports Backpack', category: 'Accessory', price: 25000, stock: 18 },
    ]);
  }
  if (path === '/pos/orders') {
    return json([
      { id: 'o1', orderNumber: 'M-1A2B3C', total: 90000, paymentMethod: 'CASH', status: 'COMPLETED', createdAt: new Date().toISOString(), customerName: 'Walk-in' },
      { id: 'o2', orderNumber: 'M-4D5E6F', total: 168000, paymentMethod: 'MOBILE', status: 'COMPLETED', createdAt: new Date().toISOString() },
      { id: 'o3', orderNumber: 'SO-DESK01', total: 45000, paymentMethod: 'CARD', status: 'COMPLETED', createdAt: '2026-06-19T10:00:00Z' },
    ]);
  }
  if (path === '/erp/sourcing/suppliers') {
    return json([
      { id: 'd1f8e6c0-1234-4abc-9def-fedcba987654', name: 'Shenzhen Sportswear Co.' },
      { id: 'a9b8c7d6-5432-4abc-9def-123456789abc', name: 'Mumbai Textiles Ltd' },
      { id: 'b2c3d4e5-6789-4abc-9def-abcdef012345', name: 'Nairobi Athletic Wear' },
    ]);
  }
  return json({});
};
await page.route('http://localhost:3000/api/**', apiHandler);
await page.route('**/api/**', apiHandler);

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const t = msg.text();
  if (/ERR_(CONNECTION|CERT|FAILED|ABORTED)|Failed to load resource|HTTP \d/.test(t)) return;
  errors.push(`console.error: ${t.slice(0, 200)}`);
});

const slug = 'kelvinfashion';
async function snap(name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
  console.log(`Saved ${name}.png`);
}

await page.goto(`${BASE}/m/${slug}`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
const ls = await page.evaluate(() => JSON.stringify({
  kobeos_user: localStorage.getItem('kobeos_user'),
  access_token: !!localStorage.getItem('access_token'),
  url: window.location.href,
  title: document.title,
  hasMobile: !!document.querySelector('[data-mobile-shell]'),
}));
console.log('STATE:', ls);
await snap('01-signin');

// Fake-sign-in by injecting a token + reload so we land on home.
await page.evaluate(() => {
  localStorage.setItem('access_token', 'demo-token-for-snapshot');
  localStorage.setItem('kobe_session_phone', '+255 712 000 000');
});
await page.goto(`${BASE}/m/${slug}`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(600);
await snap('02-home');

await page.goto(`${BASE}/m/${slug}/pos`);
await page.waitForTimeout(600);
await snap('03-pos');

await page.goto(`${BASE}/m/${slug}/po`);
await page.waitForTimeout(600);
await snap('04-po');

await page.goto(`${BASE}/m/${slug}/eod`);
await page.waitForTimeout(600);
await snap('05-eod');

await page.goto(`${BASE}/m/${slug}/summary`);
await page.waitForTimeout(600);
await snap('06-summary');

await page.goto(`${BASE}/m/${slug}/inventory`);
await page.waitForTimeout(600);
await snap('07-inventory');

await page.goto(`${BASE}/m/${slug}/orders`);
await page.waitForTimeout(600);
await snap('08-orders');

await browser.close();
console.log('Console errors:', errors.length);
errors.slice(0, 5).forEach((e) => console.log('  ' + e));
