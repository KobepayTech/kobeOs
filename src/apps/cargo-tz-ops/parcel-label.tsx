import { QRCodeSVG } from 'qrcode.react';

const prefix = ((import.meta.env.VITE_PUBLIC_PATH_PREFIX as string | undefined) || '').replace(/\/$/, '');

export function isLocalCargoTz() {
  const { protocol, hostname } = window.location;
  return protocol === 'file:' || Boolean(window.kobeOS?.runtime && ['localhost', '127.0.0.1'].includes(hostname));
}

export function cargoTzLink(path: string) {
  if (isLocalCargoTz()) {
    return `https://cargotz.kobeapptz.com${path}`;
  }
  return `${window.location.origin}${prefix}${path}`;
}

export function trackingFromScan(value: string) {
  return value.match(/\bCTZ-\d{8}-(?:[A-F0-9]{20}|\d{6,})\b/i)?.[0].toUpperCase() ?? '';
}

export type ParcelLabelData = {
  trackingNumber: string;
  origin: string;
  destination: string;
  cartonNumber?: number;
  cartonCount?: number;
};

export function ParcelLabel({ parcel }: { parcel: ParcelLabelData }) {
  const local = isLocalCargoTz();
  const url = cargoTzLink(`/ctz/${encodeURIComponent(parcel.trackingNumber)}`);
  return (
    <article className="ctz-print-label break-inside-avoid rounded-xl border bg-white p-4 text-center text-slate-950">
      <p className="text-sm font-bold">CargoTZ</p>
      <p className="text-base font-bold">{parcel.destination}</p>
      <QRCodeSVG className="mx-auto my-2" value={local ? parcel.trackingNumber : url} size={134} marginSize={4} />
      <p className="break-all font-mono text-xs">{parcel.trackingNumber}</p>
      {parcel.cartonCount && parcel.cartonCount > 1 && (
        <p className="mt-1 text-xs">Carton {parcel.cartonNumber} of {parcel.cartonCount}</p>
      )}
      {!local && <a className="mt-2 block text-xs text-emerald-800 underline print:hidden" href={url} target="_blank" rel="noreferrer">Open tracking page</a>}
    </article>
  );
}

export function LabelPrintStyles() {
  return <style>{`@media print {
    html, body, #root { height: auto !important; overflow: visible !important; }
    #root:has(.ctz-print-labels) * { visibility: hidden; }
    #root .ctz-print-labels, #root .ctz-print-labels * { visibility: visible; }
    #root .ctz-print-labels .print\\:hidden { display: none; }
    #root .ctz-print-labels { position: absolute; inset: 0 0 auto; display: block; padding: 0; }
    #root .ctz-print-label { width: 75mm; margin: 0 auto 4mm; border: 1px solid #111; }
  }`}</style>;
}
