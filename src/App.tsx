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

  /* ---- Public routes (no auth required) ---- */
  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/install" element={<InstallLandingPage />} />
          <Route path="/install/:appId" element={<InstallLandingPage />} />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
