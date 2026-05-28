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

function closeTopWindow() {
  const closeButtons = screen.getAllByRole('button').filter((candidate) => String(candidate.className).includes('bg-red-500'));
  fireEvent.click(closeButtons[closeButtons.length - 1]);
}

describe('KobeOS launcher smoke test', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('kobeos_user', 'Smoke Tester');
  });

  it('renders every launcher app without crashing', () => {
    render(<App />);

    for (const appName of launcherApps) {
      expect(screen.getByText(appName)).toBeInTheDocument();
    }
  });

  it('opens the implemented apps from the launcher', async () => {
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

  it('shows placeholders for apps not implemented yet', async () => {
    render(<App />);

    for (const appName of ['KobeERP', 'KobeHotel', 'KobeCredit', 'KobeCargo']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(appName, 'i') }));
      expect(await screen.findByText(new RegExp(`${appName.toLowerCase().replace('kobe', '')} module`, 'i'))).toBeInTheDocument();
      closeTopWindow();
    }
  });
});
