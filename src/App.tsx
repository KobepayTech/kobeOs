import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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
import MobileOrders from '@/mobile/MobileOrders';

/**
 * Thin App shell that:
 *  1. Handles authentication (login screen ↔ localStorage)
 *  2. Keeps /install routes public (shareable install links)
 *  3. Delegates the authenticated desktop to the real OS shell
 *     (src/os/Desktop.tsx) which uses appRegistry and the proper
 *     WindowManager / Taskbar.
 */
export default function App() {
  const [user, setUser] = useState<string | null>(() =>
    localStorage.getItem('kobeos_user')
  );

  const handleLogin = (username: string) => {
    setUser(username);
    localStorage.setItem('kobeos_user', username);
  };

  /* ---- Public routes (no desktop-OS auth required) ----
   * /m/* is the mobile webapp: gated by its own JWT sign-in inside
   * MobileShell so a seller on their phone doesn't need to go through
   * the desktop login first.
   */
  if (!user) {
    return (
      <BrowserRouter>
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
            <Route path="orders" element={<MobileOrders />} />
          </Route>
          <Route path="*" element={<LoginScreen onLogin={handleLogin} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  /* ---- Authenticated shell ---- */
  return (
    <BrowserRouter>
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
          <Route path="orders" element={<MobileOrders />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
