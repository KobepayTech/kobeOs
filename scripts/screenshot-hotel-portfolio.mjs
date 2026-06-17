import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Sign a long-lived pro token with the same secret vite.config.ts bakes
// into the bundle so SubscriptionGate lets us through the hotel app.
const HMAC_SECRET = 'kobe-license-secret-change-in-prod';
const licensePayload = {
  userId: 'screenshot-tester',
  plan: 'pro',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
};
const payloadB64 = Buffer.from(JSON.stringify(licensePayload)).toString('base64url');
const sig = crypto.createHmac('sha256', HMAC_SECRET).update(payloadB64).digest();
const sigB64 = sig.toString('base64url');
const fakeToken = `${payloadB64}.${sigB64}`;

await page.addInitScript(([token]) => {
  window.localStorage.setItem('kobeos_user', 'Portfolio Tester');
  window.localStorage.setItem('kobe_license_token', token);
  window.localStorage.removeItem('kobe.hotel.selectedHotelId');
}, [fakeToken]);

await page.goto(BASE);
await page.waitForLoadState('networkidle');

const launcher = page.getByRole('button', { name: /KobeHotel/i }).first();
await launcher.click();

await page.waitForTimeout(1500);

await page.screenshot({ path: path.join(outDir, '1-portfolio.png'), fullPage: false });
console.log('Saved 1-portfolio.png');

// Open property switcher and pick a specific hotel
const switcher = page.locator('button:has-text("All Properties")').first();
await switcher.click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, '2-switcher-open.png'), fullPage: false });
console.log('Saved 2-switcher-open.png');

// Click "Kobe Resort Zanzibar"
await page.locator('button:has-text("Kobe Resort Zanzibar")').first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, '3-single-hotel.png'), fullPage: false });
console.log('Saved 3-single-hotel.png');

await browser.close();
console.log('Done');
