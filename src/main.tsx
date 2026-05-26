import { createRoot } from 'react-dom/client';
import './index.css';
import { Desktop } from './os/Desktop';

// /sports/overlay  → standalone transparent OBS browser source page.
// /p/{slug}/(room|table)/{n} → public, unauthenticated hotel guest portal.
// All other paths mount the full OS shell.
const pathname = window.location.pathname;
const isOverlay = pathname.startsWith('/sports/overlay');
const isPublicGuest = pathname.startsWith('/p/');

if (isOverlay) {
  // Lazy-load to keep the main bundle lean
  import('./apps/kobe-sports/OverlayPage').then(({ default: OverlayPage }) => {
    createRoot(document.getElementById('root')!).render(<OverlayPage />);
  });
} else if (isPublicGuest) {
  import('./public/GuestPortal').then(({ default: GuestPortal }) => {
    createRoot(document.getElementById('root')!).render(<GuestPortal />);
  });
} else {
  createRoot(document.getElementById('root')!).render(<Desktop />);
}
