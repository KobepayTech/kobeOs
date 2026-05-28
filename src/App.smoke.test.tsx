import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

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

const appStoreModules = [
  'KobeERP',
  'KobeHotel',
  'KobeCredit',
  'KobeCargo',
  'KobeAnalytics',
  'KobeCRM',
  'KobeCalendar',
];

function closeTopWindow(getAllByRole: ReturnType<typeof render>['getAllByRole']) {
  const closeButtons = getAllByRole('button').filter((candidate: HTMLElement) =>
    String(candidate.className).includes('bg-red-500'),
  );
  closeButtons[closeButtons.length - 1]?.click();
}

describe('KobeOS launcher smoke test', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('kobeos_user', 'Smoke Tester');
  });

  it('renders every desktop launcher app without crashing', () => {
    const { getByText } = render(<App />);

    for (const appName of launcherApps) {
      expect(getByText(appName)).toBeInTheDocument();
    }
  });

  it('opens the implemented desktop apps from the launcher', async () => {
    const { getByRole, findAllByText, getAllByRole } = render(<App />);

    const implementedApps: Array<[string, RegExp]> = [
      ['Kobe Security', /Security-company operations/i],
      ['Hotel Security', /Saved room reviews/i],
      ['Kobe Studio', /Media Studios/i],
      ['Settings', /System Settings/i],
      ['Files', /\/home\/kobeos/i],
      ['App Store', /KobeOS App Store/i],
      ['Installer', /Install KobeOS/i],
    ];

    for (const [buttonLabel, expectedPattern] of implementedApps) {
      getByRole('button', { name: new RegExp(buttonLabel, 'i') }).click();
      const matches = await findAllByText(expectedPattern);
      expect(matches.length).toBeGreaterThan(0);
      closeTopWindow(getAllByRole);
    }
  });

  it('shows placeholders for desktop apps not implemented yet', async () => {
    const { getByRole, findByText, getAllByRole } = render(<App />);

    for (const appName of ['KobeERP', 'KobeHotel', 'KobeCredit', 'KobeCargo']) {
      getByRole('button', { name: new RegExp(appName, 'i') }).click();
      expect(await findByText(new RegExp(`${appName.toLowerCase().replace('kobe', '')} module`, 'i'))).toBeInTheDocument();
      closeTopWindow(getAllByRole);
    }
  });

  it('renders every App Store module card', async () => {
    const { getByRole, findByText, getAllByText } = render(<App />);

    getByRole('button', { name: /App Store/i }).click();
    expect(await findByText(/KobeOS App Store/i)).toBeInTheDocument();

    for (const moduleName of appStoreModules) {
      const matches = getAllByText(moduleName);
      expect(matches.length).toBeGreaterThan(0);
    }
  });
});
