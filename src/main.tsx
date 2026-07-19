import type { ReactNode } from 'react';
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
 *   /cargotz                             cargotz.kobeapptz.com
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
const subCargoTz = appSub === 'cargotz';
// Property module subdomains (#9)
const subProperty = appSub === 'property';
const subEstate   = appSub === 'estate';
const subPay      = appSub === 'pay';
const subContract = appSub === 'contract';

// Path helper — match a URL segment exactly (either the whole path is
// the segment, or the segment is followed by `/`). Prevents /me from
// eating /menu, /medical, /membership etc.
const seg = (p: string) => pathname === p || pathname.startsWith(p + '/');

const isOverlay           = pathname.startsWith('/sports/overlay');
const isPrintCard         = pathname.startsWith('/print/qr-card');
const isPrintCargoReceipt = pathname.startsWith('/print/cargo-receipt');
const isPublicGuest =
  pathname.startsWith('/p/') ||
  (tenantSub !== null && /^\/(room|table)\//i.test(pathname));
const isMobileWebapp    = pathname.startsWith('/m/');
const isKdsDisplay      = pathname.startsWith('/display/orders');
// Mzigo subdomain hosts both the public Mzigo console AND the waybill
// tracker at /track/{waybill}. Compute isMzigoTrack FIRST so its
// dispatch order in the if/else chain wins on mzigo.kobeapptz.com/track/…
const isMzigoTrack = (subMzigo && /^\/track\//i.test(pathname)) ||
                     pathname.startsWith('/mzigo/track/');
// Cargo tracking — only on the track subdomain or the /track/ apex
// path. Explicitly NOT when we're already on the mzigo subdomain,
// so mzigo.kobeapptz.com/track/… falls through to MzigoTrack.
const isPublicTracking  = !isMzigoTrack && (subTrack || pathname.startsWith('/track/'));
// Use `seg(…)` (whole-segment match) so /me doesn't eat /menu / /medical
// / /membership etc., and same for /tuma → /tumar, /posys → /posyss.
const isCustomerPortal  = subMe    || seg('/me');
const isTuma            = subTuma  || seg('/tuma');
const isMzigo = !isMzigoTrack && (subMzigo || seg('/mzigo'));
const isPosys = subPosys || seg('/posys');
const isCargoTz = subCargoTz || seg('/cargotz');
const isCoach = seg('/coach');
// Public tenant storefront: subdomain slug (kelvinfashion.kobeapptz.com)
// or apex fallback (/shop/kelvinfashion). Regex validates that the slug
// looks like a valid DNS label so a hand-crafted URL can't route
// arbitrary strings into the ErpShop query.
const shopPathMatch = pathname.match(/^\/shop\/([a-z0-9][a-z0-9-]{0,61}[a-z0-9]|[a-z0-9])\/?/i);
const shopSlug = tenantSub ?? (shopPathMatch?.[1]?.toLowerCase() ?? null);

// Public hotel booking site: {slug}.kobeapptz.com/book or /book/{slug}
const bookPathMatch = pathname.match(/^\/book\/([a-z0-9][a-z0-9-]{0,61}[a-z0-9]|[a-z0-9])\/?/i);
const bookingSlug = tenantSub ?? (bookPathMatch?.[1]?.toLowerCase() ?? null);
const isHotelBooking = seg('/book') && !!bookingSlug;

// Public payout-receipt view — the China Cashier receipt QR lands here.
// /r/{token} shows the receipt details + Pending/Paid status, no auth.
const receiptMatch = pathname.match(/^\/r\/([a-f0-9]{8,})\/?$/i);
const receiptToken = receiptMatch?.[1] ?? null;

// Public Cargo TZ parcel tracker — the parcel QR opens /ctz/{tracking}.
// Also reachable as bare /ctz to type a number.
const ctzMatch = pathname.match(/^\/ctz(?:\/([A-Za-z0-9-]+))?\/?$/);
const isCtzTrack = !!ctzMatch;
const ctzTracking = ctzMatch?.[1] ?? '';

// On a module subdomain (pay./estate./contract.) the token may be the first
// path segment, e.g. pay.kobeapptz.com/D8487KXS.
const bareCode = (pathname.match(/^\/([A-Za-z0-9]{8})\/?$/)?.[1] ?? '').toUpperCase();

// Public rent-collection panel for banks/agents: /pay, /pay/{CODE}, or pay.*
const payMatch = pathname.match(/^\/pay(?:\/([A-Za-z0-9]{1,8}))?\/?$/i);
const isRentPay = !!payMatch || subPay;
const rentPayCode = (payMatch?.[1]?.toUpperCase()) || (subPay ? bareCode : '');

// Public tenant portal (scanned estate QR): /estate, /estate/{CODE}, or estate.*
const estateMatch = pathname.match(/^\/estate(?:\/([A-Za-z0-9]{1,8}))?\/?$/i);
const isEstate = !!estateMatch || subEstate;
const estateCode = (estateMatch?.[1]?.toUpperCase()) || (subEstate ? bareCode : '');

// Public lawyer/contract portal: /contract, /contract/{CODE}, or contract.*
const contractMatch = pathname.match(/^\/contract(?:\/([A-Za-z0-9]{1,8}))?\/?$/i);
const isContract = !!contractMatch || subContract;
const contractCode = (contractMatch?.[1]?.toUpperCase()) || (subContract ? bareCode : '');

const mount = (node: ReactNode) =>
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
} else if (isCargoTz) {
  // Cargo TZ — the domestic bus-cargo operations module (3 roles: receive,
  // warehouse, owner), runnable standalone via cargotz.kobeapptz.com /
  // /cargotz. Full-height shell so its `h-full` layout fills the viewport.
  import('./apps/cargo-tz-ops/index').then(({ default: CargoTzOps }) => {
    // /cargotz/{receive|warehouse|owner} deep-links (and installs) a role.
    const roleSeg = pathname.replace(/^\/cargotz\/?/, '').split('/')[0];
    const role = roleSeg === 'warehouse' ? 'warehouse' : roleSeg === 'owner' ? 'dashboard' : roleSeg === 'receive' ? 'intake' : undefined;
    mount(<div className="h-screen w-screen overflow-hidden"><CargoTzOps role={role as 'intake' | 'warehouse' | 'dashboard' | undefined} /></div>);
  });
} else if (isCoach) {
  // Kobe Coach — installable coach/team-admin PWA (standalone at /coach).
  import('./apps/kobe-coach/index').then(({ default: KobeCoach }) =>
    mount(<div className="h-screen w-screen overflow-hidden"><KobeCoach /></div>));
} else if (isHotelBooking && bookingSlug) {
  // Public hotel booking site: {slug}.kobeapptz.com/book or /book/{slug}
  import('./public/HotelBooking').then(({ default: HotelBooking }) => mount(<HotelBooking slug={bookingSlug} />));
} else if (receiptToken) {
  // Public payout-receipt view (scanned QR): /r/{token}
  import('./public/Receipt').then(({ default: Receipt }) => mount(<Receipt token={receiptToken} />));
} else if (isCtzTrack) {
  // Public Cargo TZ parcel tracker (scanned QR): /ctz/{tracking}
  import('./public/CargoTzTrack').then(({ default: CargoTzTrack }) => mount(<CargoTzTrack tracking={ctzTracking} />));
} else if (isRentPay) {
  // Public bank/agent rent-collection panel: /pay or /pay/{CODE}
  import('./public/RentPay').then(({ default: RentPay }) => mount(<RentPay code={rentPayCode} />));
} else if (isEstate) {
  // Public tenant portal (scanned estate QR): /estate or /estate/{CODE}
  import('./public/PropertyPortal').then(({ default: PropertyPortal }) => mount(<PropertyPortal code={estateCode} />));
} else if (isContract) {
  // Public lawyer/contract portal: /contract or /contract/{CODE}
  import('./public/LawyerPortal').then(({ default: LawyerPortal }) => mount(<LawyerPortal code={contractCode} />));
} else if (subProperty) {
  // Property management app, standalone via property.kobeapptz.com (#9)
  import('./apps/property/PropEasy').then(({ default: PropEasy }) =>
    mount(<div className="h-screen w-screen overflow-hidden"><PropEasy /></div>));
} else if (shopSlug) {
  // Any non-reserved wildcard subdomain is a public shop storefront:
  //   https://kelvinfashion.kobeapptz.com
  // Apex fallback for testing/admin links:
  //   https://kobeapptz.com/shop/kelvinfashion
  import('./apps/erp-shop/index').then(({ default: ErpShop }) => mount(<ErpShop data={{ slug: shopSlug }} />));
} else {
  mount(<Desktop />);
}
