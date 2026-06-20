import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE = process.env.URL ?? 'http://localhost:5173';
const outDir = path.resolve('tmp-screenshots/erp-smoke');
fs.mkdirSync(outDir, { recursive: true });

const HMAC_SECRET = 'kobe-license-secret-change-in-prod';
const payload = {
  userId: 'erp-smoke-tester', plan: 'pro',
  issuedAt: Date.now(), expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
};
const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url');
const token = `${b64}.${sig}`;

// Each ERP module to smoke — sidebar label as shown in erp-dashboard.
// Order matters slightly: open less-stateful modules first.
const MODULES = [
  'POS System',
  'Online Shop',
  'Product Manager',
  'Store Editor',
  'Credit & Collections',
  'Discounts & Promos',
  'Warehouse',
  'Shipments (demo)',
  'Sourcing',
  'Sales & Expenses',
  'End of Day',
  'Accounting',
  'Reports',
  'Loyalty Program',
  'Admin Panel (demo)',
  'Rider Manager',
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

// Bucket errors per module (we tag the current module before each launch).
let currentModule = 'desktop-boot';
const bugs = [];
page.on('pageerror', (e) => bugs.push({ module: currentModule, kind: 'pageerror', msg: e.message }));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const txt = msg.text().slice(0, 250);
  // Filter network failures (no backend running in this env).
  if (/ERR_(CONNECTION|CERT|FAILED|ABORTED)|Failed to load resource|Network Error|HTTP 4\d\d|HTTP 5\d\d/.test(txt)) return;
  // Filter expected-empty backend responses that the modules handle.
  if (/Unexpected token/.test(txt) && /JSON/.test(txt)) return;
  bugs.push({ module: currentModule, kind: 'console', msg: txt });
});

await page.addInitScript(([t]) => {
  window.localStorage.setItem('kobeos_user', 'ERP Smoke Tester');
  window.localStorage.setItem('kobe_license_token', t);
  window.localStorage.removeItem('kobe.erp.discounts.seeded.v1');
}, [token]);

await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);

// Open ERP from the desktop launcher.
currentModule = 'erp-dashboard';
await page.locator('button[title="ERP"], button:has-text("ERP")').first().click({ timeout: 10_000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const wins = document.querySelectorAll('.rounded-3xl.border-white\\/50');
  const top = wins[wins.length - 1];
  if (top) Object.assign(top.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
});
await page.screenshot({ path: path.join(outDir, '00-dashboard.png'), fullPage: false });

async function closeTopWindow() {
  await page.locator('button[aria-label="Close"]').last().click({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

let idx = 1;
for (const label of MODULES) {
  currentModule = label;
  const before = bugs.length;
  try {
    // Click the sidebar tile by label (scoped to the ERP dashboard window).
    await page.locator(`button:has-text("${label}")`).first().click({ timeout: 8_000 });
  } catch (e) {
    bugs.push({ module: label, kind: 'cannot-click', msg: `Tile "${label}" not clickable: ${(e).message?.slice(0, 200)}` });
    continue;
  }
  await page.waitForTimeout(1500);

  // Maximise the topmost window so the screenshot is useful.
  await page.evaluate(() => {
    const wins = document.querySelectorAll('.rounded-3xl.border-white\\/50');
    const top = wins[wins.length - 1];
    if (top) Object.assign(top.style, { left: '0px', top: '0px', width: '100vw', height: 'calc(100vh - 60px)' });
  });

  const safeFn = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await page.screenshot({ path: path.join(outDir, `${String(idx).padStart(2, '0')}-${safeFn}.png`), fullPage: false }).catch(() => {});

  // Light interaction: try clicking the first primary-styled button if present
  // so we surface any onClick crashes that don't fire on mount alone.
  const primary = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Save"), button:has-text("Create")').last();
  if (await primary.count()) {
    await primary.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(500);
    // Dismiss any modal that may have opened.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
  }

  const newBugs = bugs.length - before;
  console.log(`${label}: ${newBugs} bug(s)`);

  await closeTopWindow();
  idx++;
}

await browser.close();
console.log('\n=== BUG REPORT ===');
if (bugs.length === 0) {
  console.log('No runtime errors captured.');
} else {
  const byModule = {};
  for (const b of bugs) {
    byModule[b.module] = byModule[b.module] || [];
    byModule[b.module].push(b);
  }
  for (const [m, list] of Object.entries(byModule)) {
    console.log(`\n${m} (${list.length})`);
    for (const b of list.slice(0, 5)) {
      console.log(`  [${b.kind}] ${b.msg}`);
    }
    if (list.length > 5) console.log(`  ... and ${list.length - 5} more`);
  }
}

fs.writeFileSync(
  path.join(outDir, 'bugs.json'),
  JSON.stringify(bugs, null, 2),
);
console.log(`\nWrote ${bugs.length} entries → ${path.join(outDir, 'bugs.json')}`);
