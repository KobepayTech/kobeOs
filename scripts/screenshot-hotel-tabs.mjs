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
  window.localStorage.setItem('kobeos_user', 'Tabs Tester');
  window.localStorage.setItem('kobe_license_token', t);
  window.localStorage.removeItem('kobe.hotel.selectedHotelId');
}, [token]);

await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: /KobeHotel/i }).first().click();
await page.waitForTimeout(1500);

// Maximize the hotel window
await page.evaluate(() => {
  const win = document.querySelector('[data-window-id]');
  if (win) Object.assign(win.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});

const tabs = [
  { id: 'rooms',     out: '4-rooms.png',     label: 'Rooms' },
  { id: 'food',      out: '5-food.png',      label: 'Food List' },
  { id: 'channels',  out: '6-channels.png',  label: 'Channels' },
  { id: 'inbox',     out: '7-inbox.png',     label: 'Inbox' },
];

for (const t of tabs) {
  // Click the sidebar button by its title (label).
  await page.locator(`button[title="${t.label}"]`).first().click();
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const main = document.querySelector('main.flex-1.overflow-auto');
    if (main) main.scrollTop = 0;
  });
  await page.screenshot({ path: path.join(outDir, t.out), fullPage: true });
  console.log(`Saved ${t.out}`);
}

await browser.close();
console.log('Done');
