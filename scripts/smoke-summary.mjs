import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots');

const HMAC_SECRET = 'kobe-license-secret-change-in-prod';
const payload = {
  userId: 'sum-tester', plan: 'pro',
  issuedAt: Date.now(), expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
};
const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url');
const token = `${b64}.${sig}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text().slice(0, 200)}`);
});

await page.addInitScript(([t]) => {
  window.localStorage.setItem('kobeos_user', 'Sum Tester');
  window.localStorage.setItem('kobe_license_token', t);
  window.localStorage.removeItem('kobe.erp.summary.entries.v1');
  // Launch the summary app directly via the OS store on boot.
  window.setTimeout(() => {
    const ev = new CustomEvent('kobeos:launch', { detail: { appId: 'erp-summary' } });
    window.dispatchEvent(ev);
  }, 1000);
}, [token]);

await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

// Just launch by clicking the dashboard ERP tile then Sales & Expenses.
await page.locator('button[title="ERP"], button:has-text("ERP")').first().click({ timeout: 10000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const wins = document.querySelectorAll('.rounded-3xl.border-white\\/50');
  const top = wins[wins.length - 1];
  if (top) Object.assign(top.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});
await page.locator('button:has-text("Sales & Expenses")').first().click({ timeout: 8000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const wins = document.querySelectorAll('.rounded-3xl.border-white\\/50');
  const top = wins[wins.length - 1];
  if (top) Object.assign(top.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});

// Use locators scoped to the topmost (summary) window so the dashboard
// behind it doesn't intercept clicks.
const topWin = page.locator('.rounded-3xl.border-white\\/50').last();

await topWin.locator('input[type="number"]').first().fill('15000');
await topWin.locator('input[placeholder*="Stock"]').fill('Office supplies + airtime');
await topWin.locator('button:has-text("Record expense")').click();
await page.waitForTimeout(400);
await topWin.locator('input[type="number"]').first().fill('25500');
await topWin.locator('input[placeholder*="Stock"]').fill('Transport to warehouse');
await topWin.locator('button:has-text("Record expense")').click();
await page.waitForTimeout(400);

// Switch to Sales tab (inside the summary window).
await topWin.locator('button:has-text("Sales")').first().click();
await page.waitForTimeout(300);
await topWin.locator('input[type="number"]').first().fill('250000');
await topWin.locator('button:has-text("Record sale")').click();
await page.waitForTimeout(400);
await topWin.locator('input[type="number"]').first().fill('180500');
await topWin.locator('button:has-text("Record sale")').click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'summary-sales-filled.png'), fullPage: false });
console.log('Saved summary-sales-filled.png');

// Switch back to expenses to verify list.
await topWin.locator('button:has-text("Expenses")').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'summary-expenses-filled.png'), fullPage: false });
console.log('Saved summary-expenses-filled.png');

await browser.close();
if (errors.length) {
  console.log('--- ERRORS ---');
  for (const e of errors.slice(0, 20)) console.log(e);
} else {
  console.log('No console errors.');
}
