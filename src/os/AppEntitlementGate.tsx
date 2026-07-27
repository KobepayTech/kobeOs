import { useMemo, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { AppManifest } from './types';
import { useOSStore } from './store';
import {
  CORE_APP_IDS,
  capturePayPalAppPayment,
  getAppPaymentStatus,
  listAppEntitlements,
  startPalmPesaAppPayment,
  startPayPalAppPayment,
  type AppAccess,
} from '@/lib/appMarketplace';

function currentAccess(
  access: AppAccess,
  trialEndsAt: number,
  periodEndsAt: number | null,
): AppAccess {
  const now = Date.now();
  if (periodEndsAt && periodEndsAt > now) return 'active';
  if (access === 'trial' && trialEndsAt > now) return 'trial';
  if (access === 'pending' || access === 'failed') return access;
  return 'expired';
}

export function AppEntitlementGate({
  app,
  children,
}: {
  app: AppManifest;
  children: ReactNode;
}) {
  const record = useOSStore((state) => state.appEntitlements[app.id]);
  const setAppEntitlements = useOSStore((state) => state.setAppEntitlements);
  const [msisdn, setMsisdn] = useState('');
  const [provider, setProvider] = useState<'paypal' | 'palmpesa' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const access = useMemo(() => {
    if (CORE_APP_IDS.includes(app.id as typeof CORE_APP_IDS[number])) return 'active';
    if (!record) return 'expired';
    return currentAccess(record.access, record.trialEndsAt, record.periodEndsAt);
  }, [app.id, record]);

  const refresh = async () => {
    const records = await listAppEntitlements();
    setAppEntitlements(records);
  };

  const waitForPalmPesa = async (transactionId: string) => {
    for (let attempt = 0; attempt < 36; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5_000));
      const result = await getAppPaymentStatus(transactionId);
      if (result.status === 'active') {
        await refresh();
        setMessage('Payment confirmed. Your app is unlocked.');
        setProvider(null);
        return;
      }
      if (result.status === 'failed') {
        throw new Error('PalmPesa reported that the payment failed.');
      }
    }
    throw new Error('Payment confirmation is taking longer than expected. Use Refresh access after completing payment.');
  };

  const startPalmPesa = async () => {
    if (msisdn.replace(/\D/g, '').length < 9) {
      setError('Enter a valid mobile number.');
      return;
    }
    setProvider('palmpesa');
    setError('');
    setMessage('Sending a secure PalmPesa prompt to your phone…');
    try {
      const payment = await startPalmPesaAppPayment(app.id, msisdn);
      setMessage('Approve the payment on your phone. KobeOS will unlock the app automatically.');
      await waitForPalmPesa(payment.transactionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PalmPesa payment could not be started.');
      setProvider(null);
    }
  };

  const startPayPal = async () => {
    setProvider('paypal');
    setError('');
    setMessage('Opening the secure PayPal approval page…');
    try {
      const payment = await startPayPalAppPayment(app.id);
      const popup = window.open(payment.approvalUrl, '_blank', 'noopener,noreferrer');
      if (!popup) window.location.assign(payment.approvalUrl);
      setMessage('Complete payment in PayPal. This page will check for approval.');

      let lastError: unknown;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 5_000));
        try {
          const result = await capturePayPalAppPayment(app.id, payment.orderId);
          if (result.status === 'active') {
            await refresh();
            setMessage('PayPal payment captured. Your app is unlocked.');
            setProvider(null);
            return;
          }
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error('PayPal approval was not completed in time. Use Refresh access after payment.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PayPal checkout could not be started.');
      setProvider(null);
    }
  };

  if (access === 'active' || access === 'trial') {
    return (
      <div className="relative h-full min-h-0">
        {access === 'trial' && record && (
          <div className="pointer-events-none absolute right-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50/95 px-3 py-1.5 text-[10px] font-black text-orange-700 shadow-sm backdrop-blur">
            <Clock3 className="h-3.5 w-3.5" />
            {record.daysRemaining} day{record.daysRemaining === 1 ? '' : 's'} left
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-[420px] items-center justify-center overflow-auto bg-white p-5 text-[#0a1728]"
      style={{
        '--bg-input': '#ffffff',
        '--border-secondary': '#cbd5e1',
        '--border-focus': '#ff7616',
        '--text-primary': '#0a1728',
        '--text-placeholder': '#94a3b8',
      } as React.CSSProperties}
    >
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7616]">
          {access === 'pending' ? 'Payment pending' : '14-day trial complete'}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">{app.name}</h2>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">
          App content is hidden until payment is confirmed. Choose PayPal or PalmPesa to activate 30 days of access.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={startPayPal}
            disabled={provider !== null || record?.paymentProviders.paypal === false}
            className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {provider === 'paypal' ? <Loader2 className="h-6 w-6 animate-spin" /> : <CreditCard className="h-6 w-6" />}
            <span className="mt-2 text-xs font-black">PayPal</span>
            <span className="mt-1 text-[9px] opacity-65">USD {record?.priceUsd ?? 10}</span>
          </button>
          <button
            onClick={startPalmPesa}
            disabled={provider !== null || record?.paymentProviders.palmPesa === false}
            className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {provider === 'palmpesa' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Smartphone className="h-6 w-6" />}
            <span className="mt-2 text-xs font-black">PalmPesa</span>
            <span className="mt-1 text-[9px] opacity-65">TZS {(record?.priceTzs ?? 25_000).toLocaleString()}</span>
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
          <Smartphone className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={msisdn}
            onChange={(event) => setMsisdn(event.target.value)}
            placeholder="PalmPesa mobile number"
            className="h-11 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm font-semibold outline-none"
          />
        </div>

        {message && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-left text-[10px] font-semibold leading-4 text-blue-800">
            {provider ? <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            {message}
          </div>
        )}
        {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-left text-[10px] font-semibold leading-4 text-red-700">{error}</div>}

        <button
          onClick={() => refresh().catch((err) => setError(err instanceof Error ? err.message : 'Access refresh failed.'))}
          className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-100"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh access
        </button>
        <div className="mt-4 flex items-center justify-center gap-2 text-[9px] font-semibold text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Access unlocks only after the payment provider confirms settlement.
        </div>
      </div>
    </div>
  );
}
