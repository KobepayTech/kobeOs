import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/global.css';
import { Desktop } from './os/Desktop';
import { detectAppSubdomain, detectTenantSubdomain } from './public/api';

/**
 * Routing for the standalone web bundle.
 *
 * Apps are reachable two ways:
 *
 *   Path form (works on the apex)        Subdomain form (wildcard DNS)
 *   ────────────────────────────────     ──────────────────────────────
 *   /tuma                                tuma.kobeapptz.com
 *   /mzigo                               mzigo.kobeapptz.com  (alias: cargo.)
 *   /mzigo/track/{waybill}               mzigo.kobeapptz.com/track/{waybill}
 *   /me                                  me.kobeapptz.com
 *   /track/{ref}                         track.kobeapptz.com/{ref}
 *   /posys                               posys.kobeapptz.com
 *   /shop/{slug}                         {slug}.kobeapptz.com
 *
 * Special routes that don't follow the pattern:
 *   /sports/overlay         standalone OBS browser source
 *   /print/qr-card          printable room/table QR card
 *   /print/cargo-receipt    printable cargo receipt
 *   /p/{slug}/(room|table)  guest portal (also reached as {slug}.{base}/…)
 *   /m/{slug}               mobile webapp shell
 *   /display/orders         kitchen display system
 *
 * Everything else mounts the full OS shell.
 */
const pathname = window.location.pathname;
const tenantSub = detectTenantSubdomain();
const appSub = detectAppSubdomain();

// Subdomain-mapped routes — these short-circuit the path checks below
// so e.g. https://tuma.kobeapptz.com/anything renders Tuma.
const subTuma  = appSub === 'tuma';
const subMzigo = appSub === 'mzigo';
const subMe    = appSub === 'me';
const subTrack = appSub === 'track';
const subPosys = appSub === 'posys';

const isOverlay           = pathname.startsWith('/sports/overlay');
const isPrintCard         = pathname.startsWith('/print/qr-card');
const isPrintCargoReceipt = pathname.startsWith('/print/cargo-receipt');
const isPublicGuest =
  pathname.startsWith('/p/') ||
  (tenantSub !== null && /^\/(room|table)\//i.test(pathname));
const isMobileWebapp    = pathname.startsWith('/m/');
const isKdsDisplay      = pathname.startsWith('/display/orders');
const isPublicTracking  = subTrack || pathname.startsWith('/track/');
const isCustomerPortal  = subMe    || pathname.startsWith('/me');
const isTuma            = subTuma  || pathname.startsWith('/tuma');
// Mzigo subdomain hosts both the public Mzigo console and the waybill
// tracker at /track/{waybill} → keep both behaviors.
const isMzigoTrack = (subMzigo && /^\/track\//i.test(pathname)) ||
                     pathname.startsWith('/mzigo/track/');
const isMzigo = !isMzigoTrack && (subMzigo || pathname.startsWith('/mzigo'));
const isPosys = subPosys || pathname.startsWith('/posys');
const shopPathMatch = pathname.match(/^\/shop\/([a-z0-9][a-z0-9-]{0,61}[a-z0-9]|[a-z0-9])\/?/i);
const shopSlug = tenantSub ?? (shopPathMatch?.[1]?.toLowerCase() ?? null);

const mount = (node: React.ReactNode) =>
  createRoot(document.getElementById('root')!).render(node);

if (isOverlay) {
  import('./apps/kobe-sports/OverlayPage').then(({ default: OverlayPage }) => mount(<OverlayPage />));
} else if (isPrintCard) {
  import('./public/QrCard').then(({ default: QrCard }) => mount(<QrCard />));
} else if (isPrintCargoReceipt) {
  import('./public/CargoReceipts').then(({ default: CargoReceipts }) => mount(<CargoReceipts />));
} else if (isPublicGuest) {
  import('./public/GuestPortal').then(({ default: GuestPortal }) => mount(<GuestPortal />));
} else if (isMobileWebapp) {
  import('./mobile/MobileRoot').then(({ default: MobileRoot }) => mount(<MobileRoot />));
} else if (isKdsDisplay) {
  import('./apps/pos-kds/KdsDisplay').then(({ default: KdsDisplay }) => mount(<KdsDisplay />));
} else if (isPublicTracking) {
  import('./public/CargoTrack').then(({ default: CargoTrack }) => mount(<CargoTrack />));
} else if (isCustomerPortal) {
  import('./public/CustomerPortal').then(({ default: CustomerPortal }) => mount(<CustomerPortal />));
} else if (isTuma) {
  import('./public/Tuma').then(({ default: Tuma }) => mount(<Tuma />));
} else if (isMzigoTrack) {
  import('./public/MzigoTrack').then(({ default: MzigoTrack }) => mount(<MzigoTrack />));
} else if (isMzigo) {
  import('./public/Mzigo').then(({ default: Mzigo }) => mount(<Mzigo />));
} else if (isPosys) {
  // POSys lives as a desktop OS app but is also reachable standalone
  // via posys.kobeapptz.com / /posys. Same module, no wrapper needed.
  import('./apps/posys/index').then(({ default: Posys }) => mount(<Posys />));
} else if (shopSlug) {
  // Any non-reserved wildcard subdomain is a public shop storefront:
  //   https://kelvinfashion.kobeapptz.com
  // Apex fallback for testing/admin links:
  //   https://kobeapptz.com/shop/kelvinfashion
  import('./apps/erp-shop/index').then(({ default: ErpShop }) => mount(<ErpShop data={{ slug: shopSlug }} />));
} else {
  mount(<Desktop />);
}
