import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots');
fs.mkdirSync(outDir, { recursive: true });

const HMAC_SECRET = 'kobe-license-secret-change-in-prod';
const payload = {
  userId: 'erp-tester', plan: 'pro',
  issuedAt: Date.now(), expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
};
const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url');
const token = `${b64}.${sig}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

// Capture console errors so we can report them.
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text().slice(0, 200)}`);
});

await page.addInitScript(([t]) => {
  window.localStorage.setItem('kobeos_user', 'ERP Tester');
  window.localStorage.setItem('kobe_license_token', t);
}, [token]);

await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);

async function openAppFromDesktop(label, outFile) {
  try {
    await page.locator(`button[title="${label}"], button:has-text("${label}")`).first().click({ timeout: 5000 });
  } catch {
    console.log(`Could not click ${label} — skipping`);
    return false;
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const win = document.querySelector('.rounded-3xl.border-white\\/50');
    if (win) Object.assign(win.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
  });
  await page.screenshot({ path: path.join(outDir, outFile), fullPage: false });
  console.log(`Saved ${outFile}`);
  return true;
}

async function closeTop() {
  await page.locator('button[aria-label="Close"]').last().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
}

// Launch ERP dashboard.
await openAppFromDesktop('ERP', 'erp-dashboard.png');

// From the dashboard, click into Sales & Expenses (the new module).
await page.locator('button:has-text("Sales & Expenses")').first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const wins = document.querySelectorAll('.rounded-3xl.border-white\\/50');
  const top = wins[wins.length - 1];
  if (top) Object.assign(top.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});
await page.screenshot({ path: path.join(outDir, 'erp-summary-empty.png'), fullPage: false });
console.log('Saved erp-summary-empty.png');

// Fill in an expense and a sale.
await page.locator('input[type="number"]').first().fill('15000');
await page.locator('input[placeholder*="Stock purchase"]').fill('Office supplies');
await page.locator('button:has-text("Record expense")').click();
await page.waitForTimeout(400);

// Switch to Sales tab.
await page.locator('button:has-text("Sales")').first().click();
await page.waitForTimeout(300);
await page.locator('input[type="number"]').first().fill('250000');
await page.locator('button:has-text("Record sale")').click();
await page.waitForTimeout(400);

// Switch back to Expenses to see entries.
await page.locator('button:has-text("Expenses")').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'erp-summary-filled.png'), fullPage: false });
console.log('Saved erp-summary-filled.png');

// Close summary, back to ERP dashboard, then click Online Shop.
await closeTop();
await page.waitForTimeout(500);
await page.locator('button:has-text("Online Shop")').first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const wins = document.querySelectorAll('.rounded-3xl.border-white\\/50');
  const top = wins[wins.length - 1];
  if (top) Object.assign(top.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});
await page.screenshot({ path: path.join(outDir, 'erp-shop.png'), fullPage: false });
console.log('Saved erp-shop.png');
await closeTop();

// POS for receipt print test.
await page.locator('button:has-text("POS System")').first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const wins = document.querySelectorAll('.rounded-3xl.border-white\\/50');
  const top = wins[wins.length - 1];
  if (top) Object.assign(top.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});
await page.screenshot({ path: path.join(outDir, 'erp-pos.png'), fullPage: false });
console.log('Saved erp-pos.png');

await browser.close();
console.log('Done');
if (errors.length) {
  console.log('--- ERRORS CAPTURED ---');
  for (const e of errors.slice(0, 30)) console.log(e);
}
