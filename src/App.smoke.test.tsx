import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
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

function closeTopWindow() {
  const closeButtons = screen
    .getAllByRole('button')
    .filter((candidate: HTMLElement) => String(candidate.className).includes('bg-red-500'));
  fireEvent.click(closeButtons[closeButtons.length - 1]);
}

describe('KobeOS launcher smoke test', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('kobeos_user', 'Smoke Tester');
  });

  it('renders every desktop launcher app without crashing', () => {
    render(<App />);

    for (const appName of launcherApps) {
      expect(screen.getByText(appName)).toBeInTheDocument();
    }
  });

  it('opens the implemented desktop apps from the launcher', async () => {
    render(<App />);

    const implementedApps: Array<[string, RegExp]> = [
      ['Kobe Security', /Security-company operations/i],
      ['Hotel Security', /Saved room reviews/i],
      // "Media Studios" appears in multiple elements; assert at least one exists
      ['Kobe Studio', /Media Studios/i],
      ['Settings', /System Settings/i],
      ['Files', /\/home\/kobeos/i],
      ['App Store', /KobeOS App Store/i],
      ['Installer', /Install KobeOS/i],
    ];

    for (const [buttonLabel, expectedPattern] of implementedApps) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(buttonLabel, 'i') }));
      // Use findAllByText to handle components that render the text in multiple places
      const matches = await screen.findAllByText(expectedPattern);
      expect(matches.length).toBeGreaterThan(0);
      closeTopWindow();
    }
  });

  it('shows placeholders for desktop apps not implemented yet', async () => {
    render(<App />);

    for (const appName of ['KobeERP', 'KobeHotel', 'KobeCredit', 'KobeCargo']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(appName, 'i') }));
      expect(await screen.findByText(new RegExp(`${appName.toLowerCase().replace('kobe', '')} module`, 'i'))).toBeInTheDocument();
      closeTopWindow();
    }
  });

  it('renders every App Store module card', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /App Store/i }));
    expect(await screen.findByText(/KobeOS App Store/i)).toBeInTheDocument();

    for (const moduleName of appStoreModules) {
      // Use getAllByText — some module names appear in both the desktop launcher
      // and the App Store card list simultaneously.
      const matches = screen.getAllByText(moduleName);
      expect(matches.length).toBeGreaterThan(0);
    }
  });
});
