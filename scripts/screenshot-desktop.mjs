import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots');
fs.mkdirSync(outDir, { recursive: true });

const HMAC_SECRET = 'kobe-license-secret-change-in-prod';
const payload = {
  userId: 'desktop-tester', plan: 'pro',
  issuedAt: Date.now(), expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
};
const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url');
const token = `${b64}.${sig}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

await page.addInitScript(([t]) => {
  window.localStorage.setItem('kobeos_user', 'Desktop Tester');
  window.localStorage.setItem('kobe_license_token', t);
}, [token]);

await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, 'desktop-1-fill.png'), fullPage: false });
console.log('Saved desktop-1-fill.png');

// Open KobeHotel so we can see the window chrome controls.
await page.getByRole('button', { name: /KobeHotel/i }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, 'desktop-2-window-controls.png'), fullPage: false });
console.log('Saved desktop-2-window-controls.png');

await browser.close();
console.log('Done');
