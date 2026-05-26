import { useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { buildPublicGuestUrl } from './api';

/**
 * Print-friendly single-card sheet for a room or table QR. Mounted at
 * /print/qr-card?slug=…&type=room&n=101&name=…&brand=#hex&wifi=…&pwd=…
 *
 * The page is unauthenticated — it never talks to the API. The admin
 * passes everything in query params so this can also be printed offline.
 * On mount it triggers window.print(); the user's browser handles paper
 * sizing via the @page rule. One card per sheet.
 */

interface CardParams {
  slug: string;
  locationType: 'room' | 'table';
  locationNumber: string;
  hotelName: string;
  brandColor: string;
  wifi: string;
  wifiPassword: string;
}

function readParams(): CardParams | null {
  const q = new URLSearchParams(window.location.search);
  const slug = (q.get('slug') || '').toLowerCase();
  const type = (q.get('type') || 'room').toLowerCase();
  const n = q.get('n') || '';
  if (!slug || !n || (type !== 'room' && type !== 'table')) return null;
  return {
    slug,
    locationType: type,
    locationNumber: n,
    hotelName: q.get('name') || slug,
    brandColor: q.get('brand') || '#ec4899',
    wifi: q.get('wifi') || '',
    wifiPassword: q.get('pwd') || '',
  };
}

export default function QrCard() {
  const params = useMemo(() => readParams(), []);

  useEffect(() => {
    if (!params) return;
    // Give the QR a tick to render before opening the system print dialog.
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [params]);

  if (!params) {
    return (
      <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
        <h1>Missing parameters</h1>
        <p>This page expects <code>?slug=…&amp;type=room&amp;n=101</code>.</p>
      </div>
    );
  }

  const url = buildPublicGuestUrl(params.slug, params.locationType, params.locationNumber);
  const locationLabel = params.locationType === 'room' ? 'Room' : 'Table';

  return (
    <>
      <style>{`
        @page { size: A6 portrait; margin: 8mm; }
        html, body { margin: 0; padding: 0; background: #f3f4f6; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111827; }
        .sheet { display: flex; justify-content: center; padding: 24px; }
        .card {
          width: 105mm; min-height: 148mm; background: #fff;
          border-radius: 6mm; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          display: flex; flex-direction: column; overflow: hidden;
        }
        .band {
          padding: 10mm 8mm; color: #fff;
          background: var(--brand, #ec4899);
          text-align: center;
        }
        .band h1 { margin: 0; font-size: 18pt; font-weight: 800; letter-spacing: -0.01em; }
        .band p { margin: 2mm 0 0; font-size: 9pt; opacity: 0.9; }
        .body { padding: 8mm; flex: 1; display: flex; flex-direction: column; align-items: center; }
        .location { font-size: 28pt; font-weight: 900; letter-spacing: -0.02em; color: var(--brand, #ec4899); margin: 0; line-height: 1; }
        .location-sub { font-size: 9pt; color: #6b7280; margin: 1mm 0 5mm; text-transform: uppercase; letter-spacing: 0.08em; }
        .qr-wrap { padding: 4mm; background: #fff; border: 1mm solid #f3f4f6; border-radius: 3mm; }
        .tagline { margin: 6mm 0 0; text-align: center; font-size: 10pt; line-height: 1.4; color: #374151; max-width: 70mm; }
        .wifi {
          margin-top: 6mm; padding: 4mm; width: 100%; border-radius: 3mm;
          background: #f9fafb; border: 0.5mm solid #e5e7eb; text-align: center;
        }
        .wifi-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
        .wifi-row { font-size: 10pt; font-weight: 600; color: #111827; margin-top: 1mm; }
        .footer {
          padding: 4mm 8mm 6mm; text-align: center;
          font-size: 7pt; color: #9ca3af; word-break: break-all;
        }
        @media print {
          body { background: #fff; }
          .sheet { padding: 0; }
          .card { box-shadow: none; border-radius: 0; }
        }
      `}</style>
      <div className="sheet" style={{ ['--brand' as string]: params.brandColor } as React.CSSProperties}>
        <div className="card">
          <div className="band">
            <h1>{params.hotelName}</h1>
            <p>Welcome — scan to get started</p>
          </div>
          <div className="body">
            <p className="location">{params.locationNumber}</p>
            <p className="location-sub">{locationLabel}</p>
            <div className="qr-wrap">
              <QRCodeSVG value={url} size={220} level="M" />
            </div>
            <p className="tagline">
              Scan with your phone camera to order food &amp; drinks
              {params.locationType === 'room' && ', request housekeeping, or check out'}.
            </p>
            {(params.wifi || params.wifiPassword) && (
              <div className="wifi">
                <div className="wifi-label">Wi-Fi</div>
                {params.wifi && <div className="wifi-row">{params.wifi}</div>}
                {params.wifiPassword && (
                  <div className="wifi-row" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    {params.wifiPassword}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="footer">{url}</div>
        </div>
      </div>
    </>
  );
}
