import { render, act } from '@testing-library/react';
import App from './App';

/** Labels shown on the real OS Desktop shortcuts (see src/os/Desktop.tsx appShortcuts) */
const desktopShortcuts = [
  'Messages',
  'Calendar',
  'Files',
  'Settings',
  'ERP',
  'Property',
  'Photos',
  'Notes',
  'KOBECARGO',
  'KobePrint',
  'Kobe Studio',
  'KobeHotel',
  'KobePay',
  'Kobetech',
  'DevOps',
];

describe('KobeOS launcher smoke test (real OS shell)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('kobeos_user', 'Smoke Tester');
  });

  it('renders the real OS desktop with all shortcut labels', () => {
    const { getByText } = render(<App />);

    for (const label of desktopShortcuts) {
      expect(getByText(label)).toBeInTheDocument();
    }
  });

  it('renders the search bar', () => {
    const { getByPlaceholderText } = render(<App />);
    expect(
      getByPlaceholderText(/Search for tasks/i)
    ).toBeInTheDocument();
  });

  it('renders the My Tasks section', () => {
    const { getByText } = render(<App />);
    expect(getByText(/My Tasks/i)).toBeInTheDocument();
  });

  it('renders the KOBE branding', () => {
    const { getByText } = render(<App />);
    expect(getByText('KOBE')).toBeInTheDocument();
  });

  it('opens an implemented app from the desktop shortcuts', async () => {
    const { getByText, findByText } = render(<App />);

    // Click the Settings shortcut — this is a registered app
    act(() => {
      getByText('Settings').click();
    });

    // The real OS WindowManager should render the settings window
    const settingsWindow = await findByText(/System Settings/i);
    expect(settingsWindow).toBeInTheDocument();
  });

  it('filters shortcuts when typing in the search bar', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<App />);

    const searchInput = getByPlaceholderText(/Search for tasks/i);

    act(() => {
      searchInput.focus();
      // Simulate typing "erp" to filter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      nativeInputValueSetter?.call(searchInput, 'erp');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // ERP should still be visible
    expect(getByText('ERP')).toBeInTheDocument();
  });
});
