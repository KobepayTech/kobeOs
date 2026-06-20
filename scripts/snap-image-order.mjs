import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots/image-order');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await ctx.newPage();

await page.addInitScript(() => {
  try { localStorage.removeItem('kobeos_user'); } catch { /* */ }
  localStorage.setItem('access_token', 'demo');
  localStorage.setItem('refresh_token', 'demo');
});

await page.route('http://localhost:3000/api/**', (route) => {
  const path = route.request().url().replace(/^https?:\/\/[^/]+\/api/, '').split('?')[0];
  const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/users/me') return json({ id: 'demo', displayName: 'Demo' });
  if (path === '/auth/refresh' || path === '/auth/login' || path === '/auth/register') {
    return json({ accessToken: 'demo', refreshToken: 'demo', user: { id: 'demo', displayName: 'Demo' } });
  }
  return json({});
});

await page.goto(`${BASE}/m/projerseyshop`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDir, '01-mobile-home.png'), fullPage: false });
console.log('Saved 01-mobile-home.png');

await page.goto(`${BASE}/m/projerseyshop/image-order`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, '02-mobile-pick.png'), fullPage: false });
console.log('Saved 02-mobile-pick.png');

await browser.close();
console.log('done');
