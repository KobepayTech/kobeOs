import { expect, test } from '@playwright/test';

const launcherApps = [
  'KobeERP',
  'KobeHotel',
  'Hotel Security',
  'Kobe Security',
  'Kobe Studio',
  'KobeCredit',
  'KobeCargo',
  'Settings',
  'Files',
  'App Store',
  'Installer',
];

const implementedApps: Array<[string, RegExp]> = [
  ['Kobe Security', /Security-company operations/i],
  ['Hotel Security', /Room review/i],
  ['Kobe Studio', /Media Studios/i],
  ['Settings', /System Settings/i],
  ['Files', /\/home\/kobeos/i],
  ['App Store', /KobeOS App Store/i],
  ['Installer', /Install KobeOS/i],
];

const placeholderApps = ['KobeERP', 'KobeHotel', 'KobeCredit', 'KobeCargo'];

const appStoreModules = [
  'KobeERP',
  'KobeHotel',
  'KobeCredit',
  'KobeCargo',
  'KobeAnalytics',
  'KobeCRM',
  'KobeCalendar',
];

async function closeTopWindow(page: import('@playwright/test').Page) {
  await page.locator('button.bg-red-500').last().click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('kobeos_user', 'Browser Smoke Tester');
  });
  await page.goto('/');
  await expect(page.getByText('KobeOS').first()).toBeVisible();
});

test('renders every desktop launcher app', async ({ page }) => {
  for (const appName of launcherApps) {
    await expect(page.getByText(appName, { exact: true }).first()).toBeVisible();
  }
});

test('opens implemented desktop apps in Chromium', async ({ page }) => {
  for (const [appName, expectedText] of implementedApps) {
    await page.getByRole('button', { name: new RegExp(appName, 'i') }).first().click();
    await expect(page.getByText(expectedText).first()).toBeVisible();
    await closeTopWindow(page);
  }
});

test('opens placeholder desktop apps without crashing', async ({ page }) => {
  for (const appName of placeholderApps) {
    await page.getByRole('button', { name: new RegExp(appName, 'i') }).first().click();
    const placeholderText = new RegExp(`${appName.toLowerCase().replace('kobe', '')} module`, 'i');
    await expect(page.getByText(placeholderText).first()).toBeVisible();
    await closeTopWindow(page);
  }
});

test('renders App Store module catalog', async ({ page }) => {
  await page.getByRole('button', { name: /App Store/i }).first().click();
  await expect(page.getByText(/KobeOS App Store/i).first()).toBeVisible();

  for (const moduleName of appStoreModules) {
    await expect(page.getByText(moduleName, { exact: true }).first()).toBeVisible();
  }
});
