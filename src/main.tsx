import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/global.css';
import { Desktop } from './os/Desktop';
import { detectTenantSubdomain } from './public/api';

// /sports/overlay  → standalone transparent OBS browser source page.
// /p/{slug}/(room|table)/{n} → path-form guest portal (works on apex domain).
// {slug}.{base}/(room|table)/{n} → subdomain-form guest portal (wildcard DNS).
// /print/qr-card?slug=…&type=…&n=… → printable room/table QR card sheet.
// All other paths mount the full OS shell.
const pathname = window.location.pathname;
const tenantSub = detectTenantSubdomain();
const isOverlay = pathname.startsWith('/sports/overlay');
const isPrintCard = pathname.startsWith('/print/qr-card');
const isPrintCargoReceipt = pathname.startsWith('/print/cargo-receipt');
const isPublicGuest =
  pathname.startsWith('/p/') ||
  (tenantSub !== null && /^\/(room|table)\//i.test(pathname));
// Mobile webapp shell — reached via the QR code generated in the store
// editor (https://{slug}.kobeapptz.com/m/{slug}). Lazy-loaded so the
// desktop bundle stays lean.
const isMobileWebapp = pathname.startsWith('/m/');

if (isOverlay) {
  // Lazy-load to keep the main bundle lean
  import('./apps/kobe-sports/OverlayPage').then(({ default: OverlayPage }) => {
    createRoot(document.getElementById('root')!).render(<OverlayPage />);
  });
} else if (isPrintCard) {
  import('./public/QrCard').then(({ default: QrCard }) => {
    createRoot(document.getElementById('root')!).render(<QrCard />);
  });
} else if (isPrintCargoReceipt) {
  import('./public/CargoReceipts').then(({ default: CargoReceipts }) => {
    createRoot(document.getElementById('root')!).render(<CargoReceipts />);
  });
} else if (isPublicGuest) {
  import('./public/GuestPortal').then(({ default: GuestPortal }) => {
    createRoot(document.getElementById('root')!).render(<GuestPortal />);
  });
} else if (isMobileWebapp) {
  import('./mobile/MobileRoot').then(({ default: MobileRoot }) => {
    createRoot(document.getElementById('root')!).render(<MobileRoot />);
  });
} else {
  createRoot(document.getElementById('root')!).render(<Desktop />);
}
