import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots/mobile');
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
  if (path === '/users/me') return json({ id: 'demo', email: 'demo@kobeos.test', displayName: 'Demo' });
  if (path === '/auth/refresh' || path === '/auth/login' || path === '/auth/register') {
    return json({ accessToken: 'demo', refreshToken: 'demo', user: { id: 'demo', email: 'demo@kobeos.test', displayName: 'Demo' } });
  }
  if (path === '/erp/sourcing/suppliers') {
    return json([
      { id: 'd1f8e6c0-1234-4abc-9def-fedcba987654', name: 'Shenzhen Sportswear Co.' },
      { id: 'a9b8c7d6-5432-4abc-9def-123456789abc', name: 'Mumbai Textiles Ltd' },
    ]);
  }
  return json({});
});

await page.goto(`${BASE}/m/projerseyshop/po`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

// Fill the calculator so the profit chip + summary show real numbers.
const top = page.locator('main').first();
// Pick the first supplier.
await page.locator('select').first().selectOption({ index: 1 }).catch(() => {});
await page.waitForTimeout(200);

// Line 1
const inputs = page.locator('input[type="text"], input[type="number"]');
await page.locator('input[placeholder*="Item name"]').first().fill('Real Madrid Home Jersey 25/26');
const numberInputs = page.locator('input[type="number"]');
await numberInputs.nth(0).fill('20');   // qty
await numberInputs.nth(1).fill('30000'); // unit cost
await numberInputs.nth(2).fill('45000'); // sell @

// Add a second line and fill it
await page.locator('button:has-text("Add another item")').click();
await page.waitForTimeout(200);
await page.locator('input[placeholder*="Item name"]').nth(1).fill('Barcelona Away Jersey 25/26');
await numberInputs.nth(3).fill('15');
await numberInputs.nth(4).fill('28000');
await numberInputs.nth(5).fill('42000');

// Transport
const transport = page.locator('input[placeholder="0"]').last();
await transport.fill('50000');
await page.waitForTimeout(300);

await page.screenshot({ path: path.join(outDir, '04-po.png'), fullPage: true });
console.log('Saved 04-po.png');

// Open the inline "+ New supplier" form and snap it too.
await page.locator('button:has-text("New")').first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(400);
await page.locator('input[placeholder="Supplier name *"]').fill('Guangzhou Trade Co.').catch(() => {});
await page.locator('input[placeholder="Country"]').fill('China').catch(() => {});
await page.locator('input[placeholder="Contact person"]').fill('Mr. Chen').catch(() => {});
await page.locator('input[placeholder="Phone (with country code)"]').fill('+86 138 0000 1111').catch(() => {});
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(outDir, '04b-po-new-supplier.png'), fullPage: true });
console.log('Saved 04b-po-new-supplier.png');

await browser.close();
