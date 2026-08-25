import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, ExternalLink, KeyRound, Loader2, QrCode, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';

type MetaStatus = {
  configured: boolean;
  source: 'setup' | 'environment' | 'not-configured';
  appId: string;
  redirectUri: string;
  loginConfigId: string;
  graphVersion: string;
  hasSecret: boolean;
  configuredAt: string | null;
};

type MetaFields = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  loginConfigId: string;
  graphVersion: string;
};

type SetupSession = { setupUrl: string; expiresAt: string };

const emptyFields: MetaFields = {
  appId: '',
  appSecret: '',
  redirectUri: '',
  loginConfigId: '',
  graphVersion: 'v26.0',
};

function defaultRedirectUri(): string {
  if (typeof window === 'undefined' || window.location.protocol === 'file:') return '';
  return `${window.location.origin}/api/auth/oauth/meta/callback`;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not save Meta setup';
}

export default function MetaSetupPanel({ token }: { token?: string }) {
  const standalone = Boolean(token);
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [fields, setFields] = useState<MetaFields>({ ...emptyFields, redirectUri: defaultRedirectUri() });
  const [session, setSession] = useState<SetupSession | null>(null);
  const [loading, setLoading] = useState(!standalone);
  const [saving, setSaving] = useState(false);
  const [creatingQr, setCreatingQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (standalone) return;
    let active = true;
    api<MetaStatus>('/system/meta-setup/status', { offlineFallback: false })
      .then((next) => {
        if (!active) return;
        setStatus(next);
        setFields((current) => ({
          ...current,
          appId: next.appId || current.appId,
          redirectUri: next.redirectUri || current.redirectUri,
          loginConfigId: next.loginConfigId || current.loginConfigId,
          graphVersion: next.graphVersion || current.graphVersion,
        }));
      })
      .catch((err) => { if (active) setError(messageFrom(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [standalone]);

  const update = (key: keyof MetaFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setError('');
    setSuccess('');
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = standalone
        ? await api<MetaStatus>('/system/meta-setup/activate', {
            method: 'POST',
            auth: false,
            offlineFallback: false,
            body: JSON.stringify({ ...fields, token }),
          })
        : await api<MetaStatus>('/system/meta-setup/save', {
            method: 'POST',
            offlineFallback: false,
            body: JSON.stringify(fields),
          });
      setStatus(result);
      setFields((current) => ({ ...current, appSecret: '' }));
      setSuccess(standalone ? 'Meta is configured. You can close this page.' : 'Meta setup saved securely on this server.');
      if (standalone) setSession(null);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  };

  const createQr = async () => {
    setCreatingQr(true);
    setError('');
    setSuccess('');
    try {
      const next = await api<SetupSession>('/system/meta-setup/session', {
        method: 'POST',
        offlineFallback: false,
      });
      setSession(next);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setCreatingQr(false);
    }
  };

  const copyUrl = async () => {
    if (!session) return;
    await navigator.clipboard.writeText(session.setupUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const expiry = useMemo(() => session ? new Date(session.expiresAt).toLocaleTimeString() : '', [session]);

  return (
    <div className="space-y-6 text-os-text-primary">
      <div>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-os-accent" />
          <h2 className="text-xl font-semibold">Meta sign-in setup</h2>
        </div>
        <p className="mt-1 text-sm text-os-text-secondary">
          Enter the Meta app values once. KobeOS keeps the app secret encrypted on the backend;
          it is never stored in the browser or inside the QR code.
        </p>
      </div>

      {!standalone && status && (
        <div className={`rounded-xl border p-4 text-sm ${status.configured ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
          <div className="flex items-center gap-2 font-semibold">
            {status.configured ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <KeyRound className="h-4 w-4 text-amber-300" />}
            {status.configured ? 'Meta sign-in is ready' : 'Meta sign-in needs configuration'}
          </div>
          <p className="mt-1 text-xs text-os-text-secondary">
            Source: {status.source === 'setup' ? 'saved in this server database' : status.source === 'environment' ? 'deployment environment' : 'not configured'}.
            {status.hasSecret ? ' Secret is present and masked.' : ''}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-os-text-secondary"><Loader2 className="h-4 w-4 animate-spin" /> Loading setup status…</div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Meta App ID" value={fields.appId} onChange={(value) => update('appId', value)} placeholder="1746089383246060" />
            <Field label="Meta App Secret" type="password" value={fields.appSecret} onChange={(value) => update('appSecret', value)} placeholder={status?.hasSecret ? 'Leave blank to keep current secret' : 'Paste the app secret'} autoComplete="new-password" />
            <Field label="OAuth redirect URI" value={fields.redirectUri} onChange={(value) => update('redirectUri', value)} placeholder="https://your-host.example/api/auth/oauth/meta/callback" />
            <Field label="Login configuration ID (optional)" value={fields.loginConfigId} onChange={(value) => update('loginConfigId', value)} placeholder="Meta Login for Business config ID" />
            <Field label="Graph API version" value={fields.graphVersion} onChange={(value) => update('graphVersion', value)} placeholder="v26.0" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => void submit()} disabled={saving || !fields.appId || !fields.redirectUri || (!status?.hasSecret && !fields.appSecret)} className="inline-flex items-center gap-2 rounded-lg bg-os-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Saving securely…' : standalone ? 'Activate Meta setup' : 'Save Meta setup'}
            </button>
            {standalone && <a href="/" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm text-os-text-secondary hover:bg-white/15"><ExternalLink className="h-4 w-4" /> Open KobeOS</a>}
          </div>
        </div>
      )}

      {!standalone && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start gap-3">
            <QrCode className="mt-0.5 h-5 w-5 text-os-accent" />
            <div>
              <h3 className="font-semibold">Configure from another device</h3>
              <p className="mt-1 text-xs leading-5 text-os-text-secondary">
                Generate a one-time link, scan it with your phone, and type the values there.
                The QR contains only a token, expires in 10 minutes, and can be used once.
              </p>
            </div>
          </div>
          <button onClick={() => void createQr()} disabled={creatingQr} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50">
            {creatingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {creatingQr ? 'Creating secure link…' : 'Create QR setup link'}
          </button>
          {session && (
            <div className="mt-5 grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
              <div className="w-fit rounded-xl bg-white p-3"><QRCodeSVG value={session.setupUrl} size={190} level="M" /></div>
              <div className="min-w-0 space-y-2 text-xs text-os-text-secondary">
                <p className="font-semibold text-os-text-primary">Scan before {expiry}</p>
                <p>Use the same network or a public HTTPS hostname that points to this server.</p>
                <div className="flex items-center gap-2 rounded-lg bg-black/20 p-2">
                  <code className="min-w-0 flex-1 truncate text-[10px]">{session.setupUrl}</code>
                  <button onClick={() => void copyUrl()} className="shrink-0 rounded-md bg-white/10 px-2 py-1.5 hover:bg-white/15" title="Copy setup URL">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Clipboard className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{success}</div>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-xs font-medium text-os-text-secondary">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-os-text-primary outline-none placeholder:text-os-text-muted focus:border-os-accent/60"
      />
    </label>
  );
}
