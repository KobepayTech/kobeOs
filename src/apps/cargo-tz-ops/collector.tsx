import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { PackagePlus, Printer, Truck } from 'lucide-react';
import { api, ApiError, getRefreshToken, getToken } from '@/lib/api';
import LoginScreen from '@/components/LoginScreen';
import { usePwaManifest } from '@/hooks/usePwaManifest';
import { InstallPwaButton } from '@/mobile/InstallPwaButton';
import { QRCodeSVG } from 'qrcode.react';
import { handoffLink, LabelPrintStyles, ParcelLabel, type ParcelLabelData } from './parcel-label';

type Company = { id: string; companyName: string; agentName: string; agentPhone: string };
const input = 'mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base';
const card = 'space-y-4 rounded-2xl border border-slate-200 bg-white p-4';

export default function CargoTzCollector({ startUrl }: { startUrl: string }) {
  const [signedIn, setSignedIn] = useState(() => Boolean(getToken() || getRefreshToken()));
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('invite'));
  const approvalId = useRef('');
  const [approval, setApproval] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [labels, setLabels] = useState<ParcelLabelData[]>([]);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const company = companies.find((item) => item.id === selected);

  usePwaManifest({ name: 'CargoTZ · Collecting Agent', shortName: 'CargoTZ Collect', startUrl, iconBase: '/ctz-receive' });

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    api<Company[]>('/cargotz/collector/companies', { offlineFallback: false })
      .then((rows) => {
        if (!active) return;
        setCompanies(rows);
        setSelected((id) => rows.some((row) => row.id === id) ? id : rows[0]?.id ?? '');
      })
      .catch((cause: Error) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) setSignedIn(false);
        else setError(cause.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [signedIn]);

  const acceptInvite = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const joined = await api<Company & { approved: boolean }>('/cargotz/collector/accept', {
        method: 'POST', body: JSON.stringify({ token: invite }), offlineFallback: false,
      });
      if (joined.approved) {
        setCompanies(rows => [...rows.filter(row => row.id !== joined.id), joined]);
        setSelected(joined.id);
        setApproval('');
      } else {
        approvalId.current = joined.id;
        setApproval('Request sent to ' + joined.companyName + '. You can start collecting once the owner approves.');
        return;
      }
      setInvite(null);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }, [invite]);

  useEffect(() => {
    if (signedIn && invite) void acceptInvite();
  }, [acceptInvite, invite, signedIn]);

  useEffect(() => {
    if (!approval || !signedIn) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      void api<Company[]>('/cargotz/collector/companies', { signal: controller.signal, offlineFallback: false })
        .then(rows => {
          if (controller.signal.aborted || !rows.some(row => row.id === approvalId.current)) return;
          setCompanies(rows); setSelected(approvalId.current); setApproval(''); setInvite(null);
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }).catch(() => {});
    }, 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [approval, signedIn]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const read = (name: string) => String(fields.get(name) ?? '').trim();
    const body = {
      accessId: selected,
      ownerName: read('ownerName'),
      ownerPhone: read('ownerPhone'),
      receiverName: read('receiverName') || undefined,
      receiverPhone: read('receiverPhone') || undefined,
      origin: read('origin'),
      destination: read('destination'),
      description: read('description'),
      cartonCount: Number(read('cartonCount')),
      handoff: read('handoff'),
      handoffLocation: read('handoffLocation'),
    };
    const payload = JSON.stringify(body);
    if (request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      setLabels(await api<ParcelLabelData[]>('/cargotz/collector/collections', {
        method: 'POST', offlineFallback: false, body: JSON.stringify({ ...body, requestId: request.current.id }),
      }));
      request.current = null;
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) return <LoginScreen onLogin={() => { setLoading(true); setSignedIn(true); }} />;

  return (
    <main data-surface="light" className="min-h-[100dvh] bg-slate-50 text-slate-950">
      <header className="bg-emerald-950 px-4 py-6 text-white print:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><Truck size={17} /> CargoTZ</p>
            <h1 className="mt-1 text-2xl font-bold">Collecting Agent</h1>
          </div>
          <InstallPwaButton />
        </div>
      </header>
      <div className="mx-auto max-w-xl space-y-4 p-4">
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {loading ? <p role="status">Loading your cargo companies…</p> : labels.length ? (
          <>
            <div className={card}>
              <div className="rounded-xl bg-emerald-50 p-4 text-center">
                <h2 className="text-lg font-bold">Shipment saved</h2>
                <p className="mt-1 text-sm text-slate-700">Show this handoff QR to cargo intake to open the whole shipment.</p>
                <div className="mx-auto mt-3 w-fit rounded-xl bg-white p-2">
                  <QRCodeSVG
                    value={handoffLink(labels[0].trackingNumber)}
                    size={186}
                    marginSize={4}
                    title="Shipment handoff QR"
                  />
                </div>
                <p className="mt-2 break-all font-mono text-xs text-slate-700">{labels[0].trackingNumber}</p>
                <p className="mt-1 text-xs text-slate-600">{labels.length} {labels.length === 1 ? 'carton' : 'cartons'} · {labels[0].destination}</p>
              </div>
              <p className="text-sm text-slate-600">Write the code shown for each carton in large digits on the goods. You can also print the QR labels.</p>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 font-semibold text-white" onClick={() => window.print()}><Printer size={16} /> Print labels</button>
                <button className="rounded-xl border px-4 py-2.5 font-semibold" onClick={() => setLabels([])}>New collection</button>
              </div>
            </div>
            <LabelPrintStyles />
            <div className="ctz-print-labels grid gap-3 sm:grid-cols-2">
              {labels.map((parcel) => <ParcelLabel key={parcel.trackingNumber} parcel={parcel} />)}
            </div>
          </>
        ) : (
          <>
            {approval && <p role="status" className={card}>{approval}</p>}
            {invite && !approval && (
              <section className={card}>
                <h2 className="font-bold">Cargo company invitation</h2>
                <p className="text-sm text-slate-600">Your signed-in account will request access to this cargo company.</p>
                <button className="rounded-xl bg-emerald-800 px-4 py-2.5 font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void acceptInvite()}>{busy ? 'Requesting access…' : 'Request access'}</button>
              </section>
            )}
            {!companies.length ? <p className={card}>Open a collector invitation from your cargo company to start.</p> : (
              <form className={card} onSubmit={(event) => void submit(event)}>
                <h2 className="flex items-center gap-2 text-lg font-bold"><PackagePlus size={20} /> New collection</h2>
                <label className="block text-sm font-medium">Cargo company
                  <select className={input} value={selected} onChange={(event) => setSelected(event.target.value)}>
                    {companies.map((item) => <option key={item.id} value={item.id}>{item.companyName} · {item.agentName}</option>)}
                  </select>
                </label>
                {company && <p className="text-sm text-slate-600">Collector on record · {company.agentName} · {company.agentPhone}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">Goods owner<input name="ownerName" required maxLength={120} className={input} /></label>
                  <label className="text-sm font-medium">Owner phone<input name="ownerPhone" type="tel" required maxLength={25} className={input} aria-describedby="cargo-owner-phone-help" />
                    <span id="cargo-owner-phone-help" className="mt-1 block text-xs text-slate-600">Contact number for shipment notifications.</span>
                  </label>
                  <label className="text-sm font-medium">Origin city<input name="origin" required maxLength={80} placeholder="Dar es Salaam" className={input} /></label>
                  <label className="text-sm font-medium">Destination branch<input name="destination" required maxLength={80} placeholder="Mbeya" className={input} /></label>
                </div>
                <details className="rounded-xl border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">A different person will receive the goods</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label>Recipient name<input name="receiverName" maxLength={120} className={input} /></label>
                    <label>Recipient phone<input name="receiverPhone" type="tel" maxLength={25} className={input} /></label>
                  </div>
                </details>
                <label className="block text-sm font-medium">Items collected by shop
                  <textarea name="description" required maxLength={500} rows={3} placeholder="Shop A: 12 shirts. Shop B: 6 pairs of shoes." className={input} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">Sealed cartons<input name="cartonCount" type="number" defaultValue={1} min={1} max={100} required className={input} /></label>
                  <label className="text-sm font-medium">Handoff method
                    <select name="handoff" className={input}><option value="PICKUP">Cargo company picks up</option><option value="DROPOFF">I drop off at cargo office</option></select>
                  </label>
                </div>
                <label className="block text-sm font-medium">Pickup address or drop-off office<input name="handoffLocation" required maxLength={500} className={input} /></label>
                <button disabled={busy || !selected} className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save & show handoff QR'}</button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
