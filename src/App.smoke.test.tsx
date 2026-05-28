import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
      const button = screen.getByRole('button', { name: new RegExp(buttonLabel, 'i') });
      fireEvent.click(button);
      expect(await screen.findByText(new RegExp(expectedText, 'i'))).toBeInTheDocument();

      const windowChrome = screen.getByText(new RegExp(buttonLabel.split(' ')[0], 'i')).closest('div');
      const closeButtons = screen.getAllByRole('button').filter((candidate) => candidate.className.includes('bg-red-500'));
      fireEvent.click(closeButtons[closeButtons.length - 1]);
      expect(windowChrome).toBeTruthy();
    }
  });

  it('shows placeholders for apps not implemented yet', async () => {
    render(<App />);

    for (const appName of ['KobeERP', 'KobeHotel', 'KobeCredit', 'KobeCargo']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(appName, 'i') }));
      expect(await screen.findByText(/module/i)).toBeInTheDocument();
      const closeButtons = screen.getAllByRole('button').filter((candidate) => candidate.className.includes('bg-red-500'));
      fireEvent.click(closeButtons[closeButtons.length - 1]);
    }
  });
});
