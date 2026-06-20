import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots');

const HMAC_SECRET = 'kobe-license-secret-change-in-prod';
const payload = {
  userId: 'tb-tester', plan: 'pro',
  issuedAt: Date.now(), expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
};
const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url');
const token = `${b64}.${sig}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.addInitScript(([t]) => {
  window.localStorage.setItem('kobeos_user', 'TB Tester');
  window.localStorage.setItem('kobe_license_token', t);
}, [token]);

await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: /KobeHotel/i }).first().click();
await page.waitForTimeout(1200);

// Capture just the top of the topmost open window — selected by the
// frosted-glass window class.
const win = page.locator('.rounded-3xl.border-white\\/50').first();
const box = await win.boundingBox();
if (!box) throw new Error('window not found');
await page.screenshot({
  path: path.join(outDir, 'titlebar-zoom.png'),
  clip: { x: box.x, y: box.y, width: Math.min(420, box.width), height: 56 },
});
console.log('Saved titlebar-zoom.png');

await browser.close();
