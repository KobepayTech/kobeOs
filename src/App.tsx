import { useState } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';

/* Real OS shell — delegates to the full Desktop environment */
import { Desktop } from '@/os/Desktop';

/* Auth & shared chrome */
import LoginScreen from '@/components/LoginScreen';
import LiveModeBanner from '@/components/LiveModeBanner';
import { ShopSwitcher } from '@/components/ShopSwitcher';

/* Direct-access pages (outside the OS window manager) */
import SystemSettings from '@/components/SystemSettings';
import FileManager from '@/components/FileManager';
import AppStore from '@/components/AppStore';
import KobeOSInstaller from '@/components/KobeOSInstaller';
import InstallLandingPage from '@/components/InstallLandingPage';
import KobeSecurity from '@/modules/kobe-security/KobeSecurity';
import HotelSecurity from '@/modules/kobe-hotel/security/HotelSecurity';
import KobeStudio from '@/modules/kobe-studio/KobeStudio';

/* Mobile webapp — entry at /m/:slug, reachable via the QR generated in the
 * store editor. Sellers and admin use this for POS, PO, EOD, etc. on a
 * phone. Has its own sign-in inside MobileShell so it doesn't depend on
 * the desktop OS login. */
import MobileShell, { MobileHome } from '@/mobile/MobileShell';
import MobilePOS from '@/mobile/MobilePOS';
import MobilePO from '@/mobile/MobilePO';
import MobileImageOrder from '@/mobile/MobileImageOrder';
import MobileEod from '@/mobile/MobileEod';
import MobileSummary from '@/mobile/MobileSummary';
import MobileInventory from '@/mobile/MobileInventory';
import MobileHotelDepartmentOrder from '@/mobile/MobileHotelDepartmentOrder';
import MobileOrders from '@/mobile/MobileOrders';
import {
  getStoredAuthUser,
  hasStoredSession,
  type AuthUser,
} from '@/lib/auth';
import { useOSStore } from '@/os/store';

const ENTITLEMENT_OWNER_KEY = 'kobeos_entitlement_owner';

function isElectronShell(): boolean {
  return typeof window !== 'undefined' && 'kobeOS' in window;
}

function initialAccount(): AuthUser | null {
  const stored = getStoredAuthUser();
  if (!stored || !hasStoredSession()) return null;

  // Entitlements are persisted for offline continuity, so explicitly bind
  // that cache to the account that downloaded it. Without this check, a
  // different account on the same computer could briefly inherit the prior
  // user's installed/paid apps while Kobe Cloud was loading.
  try {
    if (localStorage.getItem(ENTITLEMENT_OWNER_KEY) !== stored.id) {
      useOSStore.getState().setAppEntitlements([]);
      localStorage.setItem(ENTITLEMENT_OWNER_KEY, stored.id);
    }
  } catch {
    useOSStore.getState().setAppEntitlements([]);
  }
  return stored;
}

const Router = isElectronShell()
  ? HashRouter
  : BrowserRouter;

/**
 * Thin App shell that:
 *  1. Handles authentication (login screen ↔ localStorage)
 *  2. Keeps /install routes public (shareable install links)
 *  3. Delegates the authenticated desktop to the real OS shell
 *     (src/os/Desktop.tsx) which uses appRegistry and the proper
 *     WindowManager / Taskbar.
 */
export default function App() {
  const [user, setUser] = useState<AuthUser | null>(initialAccount);
  const [storeSetupComplete, setStoreSetupComplete] = useState(() =>
    (() => {
      const stored = getStoredAuthUser();
      return !!stored &&
        localStorage.getItem(`kobeos_store_onboarding_complete:${stored.id}`) === 'true';
    })()
  );

  const handleLogin = (account: AuthUser, _created: boolean) => {
    useOSStore.getState().setAppEntitlements([]);
    try {
      localStorage.setItem(ENTITLEMENT_OWNER_KEY, account.id);
    } catch { /* storage may be unavailable */ }
    setUser(account);
    setStoreSetupComplete(
      localStorage.getItem(`kobeos_store_onboarding_complete:${account.id}`) === 'true',
    );
  };

  /* ---- Public routes (no desktop-OS auth required) ----
   * /m/* is the mobile webapp: gated by its own JWT sign-in inside
   * MobileShell so a seller on their phone doesn't need to go through
   * the desktop login first.
   */
  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/install" element={<InstallLandingPage />} />
          <Route path="/install/:appId" element={<InstallLandingPage />} />
          <Route path="/m/:slug" element={<MobileShell />}>
            <Route index element={<MobileHome />} />
            <Route path="pos" element={<MobilePOS />} />
            <Route path="po" element={<MobilePO />} />
            <Route path="image-order" element={<MobileImageOrder />} />
            <Route path="eod" element={<MobileEod />} />
            <Route path="summary" element={<MobileSummary />} />
            <Route path="inventory" element={<MobileInventory />} />
            <Route path="hotel/bar" element={<MobileHotelDepartmentOrder department="bar" />} />
            <Route path="hotel/kitchen" element={<MobileHotelDepartmentOrder department="kitchen" />} />
            <Route path="hotel/cleaning" element={<MobileHotelDepartmentOrder department="cleaning" />} />
            <Route path="hotel/room-amenities" element={<MobileHotelDepartmentOrder department="room-amenities" />} />
            <Route path="orders" element={<MobileOrders />} />
          </Route>
          <Route path="*" element={<LoginScreen onLogin={handleLogin} />} />
        </Routes>
      </Router>
    );
  }

  /* A newly installed KobeOS instance always opens the App Store after the
   * online account step. This flag is device-local: signing into the same
   * account on another fresh installation repeats app selection for that
   * computer, while the cloud entitlement list restores paid/trial status. */
  if (!storeSetupComplete) {
    return (
      <Router>
        <Routes>
          <Route
            path="/store"
            element={
              <AppStore
                onboarding
                onComplete={() => {
                  localStorage.setItem(`kobeos_store_onboarding_complete:${user.id}`, 'true');
                  setStoreSetupComplete(true);
                  if (isElectronShell()) {
                    window.location.hash = '#/';
                  } else {
                    window.location.assign('/');
                  }
                }}
              />
            }
          />
          <Route path="*" element={<Navigate to="/store" replace />} />
        </Routes>
      </Router>
    );
  }

  /* ---- Authenticated shell ---- */
  return (
    <Router>
      <LiveModeBanner />

      <div className="fixed top-1 right-2 z-50">
        <ShopSwitcher compact />
      </div>

      <Routes>
        {/* Root route renders the full OS desktop environment */}
        <Route
          path="/"
          element={
            <div className="relative w-screen h-screen overflow-hidden">
              <Desktop />
            </div>
          }
        />

        {/* Direct-access routes — rendered outside the OS window manager */}
        <Route path="/installer" element={<KobeOSInstaller />} />
        <Route path="/settings" element={<SystemSettings />} />
        <Route path="/files" element={<FileManager />} />
        <Route path="/store" element={<AppStore />} />
        <Route path="/security" element={<KobeSecurity />} />
        <Route path="/hotel-security" element={<HotelSecurity />} />
        <Route path="/studio" element={<KobeStudio />} />

        {/* Install routes (also reachable when authenticated) */}
        <Route path="/install" element={<InstallLandingPage />} />
        <Route path="/install/:appId" element={<InstallLandingPage />} />

        {/* Mobile webapp — same routes work whether or not the desktop
         *  login has happened first. */}
        <Route path="/m/:slug" element={<MobileShell />}>
          <Route index element={<MobileHome />} />
          <Route path="pos" element={<MobilePOS />} />
          <Route path="po" element={<MobilePO />} />
          <Route path="image-order" element={<MobileImageOrder />} />
          <Route path="eod" element={<MobileEod />} />
          <Route path="summary" element={<MobileSummary />} />
            <Route path="inventory" element={<MobileInventory />} />
            <Route path="hotel/bar" element={<MobileHotelDepartmentOrder department="bar" />} />
            <Route path="hotel/kitchen" element={<MobileHotelDepartmentOrder department="kitchen" />} />
            <Route path="hotel/cleaning" element={<MobileHotelDepartmentOrder department="cleaning" />} />
            <Route path="hotel/room-amenities" element={<MobileHotelDepartmentOrder department="room-amenities" />} />
          <Route path="orders" element={<MobileOrders />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
