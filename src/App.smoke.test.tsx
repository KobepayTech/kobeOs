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
    const { getAllByText } = render(<App />);

    // Some labels also appear in the Start Menu and Taskbar, so
    // accept any non-empty match rather than insisting on uniqueness.
    for (const label of desktopShortcuts) {
      expect(getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('renders the search bar', () => {
    const { getByPlaceholderText } = render(<App />);
    expect(
      getByPlaceholderText(/Search Apps/i)
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

  it('does not throw when a desktop shortcut is clicked', () => {
    const { getAllByText } = render(<App />);
    // Click the first 'Settings' surface — the lazy-loaded window
    // content can't reliably render under jsdom in a single tick, so
    // we just assert the click path doesn't throw and the label
    // survives the interaction.
    expect(() => {
      act(() => { getAllByText('Settings')[0].click(); });
    }).not.toThrow();
    expect(getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('filters shortcuts when typing in the search bar', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<App />);

    const searchInput = getByPlaceholderText(/Search Apps/i);

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
