import type { ReactNode } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Lock, Loader2, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import type { SubscriptionTier } from './types';

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/api';

async function initiatePayment(plan: 'trial' | 'pro', msisdn: string) {
  const token = localStorage.getItem('kobe_access_token');
  const res = await fetch(`${API_BASE}/license/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ plan, msisdn }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ transactionId: string; orderId: string; amount: number }>;
}

async function pollStatus(transactionId: string): Promise<{ status: string; token?: string; expiresAt?: number }> {
  const token = localStorage.getItem('kobe_access_token');
  const res = await fetch(`${API_BASE}/license/status/${transactionId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---------------------------------------------------------------------------
// Paywall UI
// ---------------------------------------------------------------------------

const TIER_LABELS: Record<Exclude<SubscriptionTier, 'free'>, string> = {
  trial: 'KobeOS Trial',
  pro:   'KobeOS Pro',
};

const TIER_PRICES: Record<Exclude<SubscriptionTier, 'free'>, string> = {
  trial: '2,000 TZS / month',
  pro:   '10,000 TZS / month',
};

const TIER_FEATURES: Record<Exclude<SubscriptionTier, 'free'>, string[]> = {
  trial: [
    'All productivity apps (spreadsheet, notes, calendar)',
    'Media & entertainment (music, video, games)',
    'Developer tools (IDE, API tester, git client)',
    'Communication apps (email, chat, video calls)',
  ],
  pro: [
    'Everything in Trial',
    'Full ERP suite (POS, accounting, warehouse, reports)',
    'KOBECARGO logistics platform',
    'KobeHotel management system',
    'KobePay payments & wallets',
    'Kobe Studio creator platform',
  ],
};

type PaywallStep = 'idle' | 'entering' | 'pending' | 'success' | 'error';

function Paywall({ required }: { required: Exclude<SubscriptionTier, 'free'> }) {
  const { activateLicense, isExpired, plan } = useSubscription();

  const [step, setStep] = useState<PaywallStep>('idle');
  const [msisdn, setMsisdn] = useState('');
  const [error, setError] = useState('');
  const [txId, setTxId] = useState('');
  const [pollCount, setPollCount] = useState(0);

  // Determine which plan to offer: if user has trial but needs pro, offer pro upgrade
  const offerPlan: 'trial' | 'pro' =
    required === 'pro' && plan === 'trial' ? 'pro' : required;

  const handleInitiate = useCallback(async () => {
    if (!msisdn.trim()) { setError('Enter your mobile number'); return; }
    setError('');
    setStep('pending');
    try {
      const { transactionId } = await initiatePayment(offerPlan, msisdn.trim());
      setTxId(transactionId);
      setPollCount(0);
    } catch (e) {
      setError((e as Error).message || 'Payment initiation failed');
      setStep('entering');
    }
  }, [msisdn, offerPlan]);

  // Poll for activation after USSD push
  useEffect(() => {
    if (step !== 'pending' || !txId) return;

    const MAX_POLLS = 36; // 3 min at 5s intervals
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const result = await pollStatus(txId);
        if (result.status === 'active' && result.token) {
          await activateLicense(result.token);
          if (!cancelled) setStep('success');
          return;
        }
        if (result.status === 'failed') {
          if (!cancelled) { setError('Payment failed. Please try again.'); setStep('error'); }
          return;
        }
      } catch {
        // network error — keep polling
      }
      if (!cancelled) {
        setPollCount((c) => {
          if (c >= MAX_POLLS) {
            setError('Payment timed out. Check your phone and try again.');
            setStep('error');
            return c;
          }
          return c + 1;
        });
      }
    };

    const timer = setInterval(poll, 5_000);
    poll(); // immediate first check
    return () => { cancelled = true; clearInterval(timer); };
  }, [step, txId, activateLicense]);

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-400" />
        <h2 className="text-xl font-semibold text-white">License Activated!</h2>
        <p className="text-sm text-white/60">Your {TIER_LABELS[offerPlan]} subscription is now active.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center select-none">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
        <Lock className="w-8 h-8 text-indigo-400" />
      </div>

      {/* Heading */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">
          {isExpired ? 'Subscription Expired' : `${TIER_LABELS[offerPlan]} Required`}
        </h2>
        <p className="text-sm text-white/50">
          {isExpired
            ? 'Your license has expired. Renew to continue.'
            : `This app requires an active ${TIER_LABELS[offerPlan]} subscription.`}
        </p>
      </div>

      {/* Price */}
      <div className="px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium">
        {TIER_PRICES[offerPlan]}
      </div>

      {/* Features */}
      <ul className="text-left space-y-1.5 max-w-xs">
        {TIER_FEATURES[offerPlan].map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-white/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* Payment form */}
      {(step === 'idle' || step === 'entering') && (
        <div className="w-full max-w-xs space-y-3">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <Smartphone className="w-4 h-4 text-white/40 shrink-0" />
            <input
              type="tel"
              placeholder="0712 345 678"
              value={msisdn}
              onChange={(e) => { setMsisdn(e.target.value); setStep('entering'); }}
              className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
            />
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}
          <button
            onClick={handleInitiate}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            Pay via USSD Push
          </button>
          <p className="text-[11px] text-white/30">
            A USSD prompt will be sent to your phone. Confirm to activate.
          </p>
        </div>
      )}

      {/* Pending / polling */}
      {step === 'pending' && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-sm text-white/60">Waiting for USSD confirmation…</p>
          <p className="text-xs text-white/30">Check your phone and enter your PIN</p>
          <button
            onClick={() => { setStep('idle'); setTxId(''); }}
            className="text-xs text-white/40 hover:text-white/60 underline mt-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error retry */}
      {step === 'error' && (
        <div className="flex flex-col items-center gap-3">
          <p className="flex items-center gap-1.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
          <button
            onClick={() => { setStep('idle'); setError(''); setTxId(''); }}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/70 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate wrapper
// ---------------------------------------------------------------------------

interface SubscriptionGateProps {
  /** Minimum tier required to render children. */
  required: SubscriptionTier;
  children: ReactNode;
}

/**
 * Wraps an app component and shows a paywall if the current license doesn't
 * satisfy the required subscription tier. Free-tier apps always pass through.
 */
export function SubscriptionGate({ required, children }: SubscriptionGateProps) {
  const { check } = useSubscription();

  if (required === 'free' || check(required)) {
    return <>{children}</>;
  }

  return (
    <div className="w-full h-full bg-[#0d0d1a] overflow-auto">
      <Paywall required={required as Exclude<SubscriptionTier, 'free'>} />
    </div>
  );
}
