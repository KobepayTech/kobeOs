import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots');
fs.mkdirSync(outDir, { recursive: true });

const HMAC_SECRET = 'kobe-license-secret-change-in-prod';
const payload = {
  userId: 'screenshot-tester', plan: 'pro',
  issuedAt: Date.now(), expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
};
const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url');
const token = `${b64}.${sig}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await ctx.newPage();

await page.addInitScript(([t]) => {
  window.localStorage.setItem('kobeos_user', 'Wizard Tester');
  window.localStorage.setItem('kobe_license_token', t);
}, [token]);

await page.goto(BASE);
await page.waitForLoadState('networkidle');

// Seed a supplier and a customer so the wizard has something to pick.
async function seedContacts() {
  await page.evaluate(async () => {
    const tok = localStorage.getItem('access_token');
    if (!tok) return; // no auth in this run; the wizard will still render empty
    const post = (url, body) => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify(body),
    }).catch(() => null);
    await post('/api/kobepay/suppliers', { name: 'Jubed Ahmed', country: 'NG', phone: '+234 803 100 9000' });
    await post('/api/kobepay/customers', { name: 'Sarah Mwangi', phone: '+254 712 345 678', email: 'sarah@example.com' });
  });
}
await seedContacts();

// Open KobePay app from launcher.
await page.getByRole('button', { name: /KobePay/i }).first().click();
await page.waitForTimeout(1200);

// Maximise the kobepay window so the wizard modal isn't clipped.
await page.evaluate(() => {
  const win = document.querySelector('[data-window-id]');
  if (win) Object.assign(win.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});

// Click "Send Money" button to open wizard.
await page.locator('button:has-text("Send Money")').first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'sm-1-select.png'), fullPage: true });
console.log('Saved sm-1-select.png');

// Step 1: pick the first contact card.
const firstCard = page.locator('button:has(:text("supplier")), button:has(:text("customer"))').first();
const clicked = await firstCard.click({ timeout: 5000 }).then(() => true).catch(() => false);
if (!clicked) {
  console.log('No contact rows available — leaving step 1 screenshot only.');
  await browser.close();
  process.exit(0);
}
await page.waitForTimeout(300);

// Advance to step 2.
await page.locator('button:has-text("Continue")').click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, 'sm-2-amount.png'), fullPage: true });
console.log('Saved sm-2-amount.png');

// Open the currency picker on the You-send card so we can show the search dropdown.
await page.locator('button:has-text("USD")').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'sm-3-currency.png'), fullPage: true });
console.log('Saved sm-3-currency.png');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// Click Set Schedule pill to open the inline schedule picker.
await page.locator('button:has-text("Set Schedule")').click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'sm-4-schedule.png'), fullPage: true });
console.log('Saved sm-4-schedule.png');

// Advance to step 3 (Recipient / Rail).
await page.locator('button:has-text("Continue")').click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'sm-5-rail.png'), fullPage: true });
console.log('Saved sm-5-rail.png');

// Advance to step 4 (Review).
await page.locator('button:has-text("Continue")').click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'sm-6-review.png'), fullPage: true });
console.log('Saved sm-6-review.png');

await browser.close();
console.log('Done');
