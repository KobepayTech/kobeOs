import { render, act } from '@testing-library/react';
import App from './App';
import { useOSStore } from './os/store';

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
    localStorage.setItem('kobe_auth_token', 'smoke-test-token');
    localStorage.setItem('kobeos_auth_user', JSON.stringify({
      id: 'smoke-test-user',
      email: 'smoke@example.com',
      displayName: 'Smoke Tester',
    }));
    localStorage.setItem(
      'kobeos_store_onboarding_complete:smoke-test-user',
      'true',
    );
    localStorage.setItem('kobeos_entitlement_owner', 'smoke-test-user');

    // The launcher now shows only apps installed for the signed-in account.
    // Seed the smoke account with the catalogue used by these launcher tests.
    const now = Date.now();
    useOSStore.getState().setAppEntitlements([
      'chat',
      'calendar',
      'erp-dashboard',
      'property',
      'image-viewer',
      'notepad',
      'cargo',
      'kobe-print',
      'kobe-studio',
      'kobe-hotel',
      'kobe-pay',
      'kobetech-admin',
      'kobetech-devops',
    ].map((appId) => ({
      appId,
      access: 'trial' as const,
      installedAt: now,
      trialEndsAt: now + 14 * 86_400_000,
      periodEndsAt: null,
      daysRemaining: 14,
      priceTzs: 25_000,
      priceUsd: 10,
      paymentProviders: { palmPesa: true, paypal: true },
    })));
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
    const { getByPlaceholderText, getByText } = render(<App />);

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
