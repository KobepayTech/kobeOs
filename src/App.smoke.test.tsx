import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  const closeButtons = screen.getAllByRole('button').filter((candidate) => String(candidate.className).includes('bg-red-500'));
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

    const implementedApps = [
      ['Kobe Security', 'Security-company operations'],
      ['Hotel Security', 'Hotel Security'],
      ['Kobe Studio', 'Kobe Studio'],
      ['Settings', 'Settings'],
      ['Files', 'Files'],
      ['App Store', 'App Store'],
      ['Installer', 'Installer'],
    ];

    for (const [buttonLabel, expectedText] of implementedApps) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(buttonLabel, 'i') }));
      expect(await screen.findByText(new RegExp(expectedText, 'i'))).toBeInTheDocument();
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
      expect(screen.getByText(moduleName)).toBeInTheDocument();
    }
  });
});
