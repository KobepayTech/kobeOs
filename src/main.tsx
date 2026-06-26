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
// Kitchen Display System — full-screen TV view of incoming POS orders
// for the warehouse / kitchen / back-of-house. No OS shell, big fonts,
// dark background, designed for a 1080p TV viewed from 3 m.
const isKdsDisplay = pathname.startsWith('/display/orders');
// Public cargo tracking page — no auth, anyone with a parcel/shipment
// reference number can see the lifecycle status. Designed to be
// shareable over WhatsApp (https://app.kobeapptz.com/track/PA-XXXXXX).
const isPublicTracking = pathname.startsWith('/track/');
// Customer self-serve portal — phone + OTP login, then dashboard of
// own parcels, POS purchases, loyalty points, and cargo wallet.
const isCustomerPortal = pathname.startsWith('/me');
// KobeOS · Tuma — paper-voucher-replacement money transfer. Standalone
// public page at /tuma; uses localStorage for now, no auth required.
const isTuma = pathname.startsWith('/tuma');
// KobeOS · Mzigo — TZ ground-cargo 4-role flow. Public, no auth.
const isMzigo = pathname.startsWith('/mzigo');

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
} else if (isKdsDisplay) {
  import('./apps/pos-kds/KdsDisplay').then(({ default: KdsDisplay }) => {
    createRoot(document.getElementById('root')!).render(<KdsDisplay />);
  });
} else if (isPublicTracking) {
  import('./public/CargoTrack').then(({ default: CargoTrack }) => {
    createRoot(document.getElementById('root')!).render(<CargoTrack />);
  });
} else if (isCustomerPortal) {
  import('./public/CustomerPortal').then(({ default: CustomerPortal }) => {
    createRoot(document.getElementById('root')!).render(<CustomerPortal />);
  });
} else if (isTuma) {
  import('./public/Tuma').then(({ default: Tuma }) => {
    createRoot(document.getElementById('root')!).render(<Tuma />);
  });
} else if (isMzigo) {
  import('./public/Mzigo').then(({ default: Mzigo }) => {
    createRoot(document.getElementById('root')!).render(<Mzigo />);
  });
} else {
  createRoot(document.getElementById('root')!).render(<Desktop />);
}
