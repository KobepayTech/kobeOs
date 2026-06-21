import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  Send, MessageCircle, Phone, Loader2, History, CheckCircle2, XCircle,
  Users, RefreshCw, AlertTriangle,
} from 'lucide-react';

/**
 * Customer Messaging — bulk SMS + WhatsApp template sends.
 *
 * Two tabs:
 *   Compose  — pick a channel, recipients, body, fire it off
 *   History  — past campaigns with sent/failed counts, click for
 *              per-recipient drilldown, "Retry failures" button.
 *
 * Recipient picker pulls de-duplicated phone numbers from past POS
 * orders (the "customers I have" list). Operator can also paste
 * arbitrary phones for one-off blasts.
 */

interface Customer {
  phone: string;
  name?: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt?: string;
}

interface Campaign {
  id: string;
  channel: 'sms' | 'whatsapp';
  body: string;
  templateName?: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: 'PENDING' | 'SENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  finishedAt?: string | null;
}

interface CampaignMessage {
  id: string;
  phone: string;
  customerName?: string | null;
  body: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  error?: string | null;
  sentAt?: string | null;
}

type Tab = 'compose' | 'history';

const fmtMoney = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;

export default function MessagingApp() {
  const [tab, setTab] = useState<Tab>('compose');
  return (
    <div className="h-full flex flex-col bg-[#0e0e18] text-white">
      <header className="h-14 px-6 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-indigo-400" />
          <span className="font-extrabold">Customer Messaging</span>
        </div>
        <div className="flex items-center gap-1">
          <TabButton active={tab === 'compose'} onClick={() => setTab('compose')} icon={<Send className="w-4 h-4" />}>
            Compose
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={<History className="w-4 h-4" />}>
            History
          </TabButton>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        {tab === 'compose' ? <ComposeView /> : <HistoryView />}
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-9 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
        active ? 'bg-indigo-500/20 text-indigo-200' : 'text-white/60 hover:bg-white/[0.05]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ComposeView() {
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [body, setBody] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pasted, setPasted] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Campaign | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<Customer[]>('/notifications/customers');
        if (!cancelled && Array.isArray(list)) setCustomers(list);
      } catch (e) {
        if (!cancelled) setErr(`Couldn't load customers: ${(e as Error).message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Parse pasted phones — accept newline / comma / semicolon separated.
  const pastedPhones = useMemo(() => {
    return pasted.split(/[\s,;]+/).map((p) => p.trim()).filter((p) => p.length >= 8);
  }, [pasted]);

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === customers.length ? new Set() : new Set(customers.map((c) => c.phone)),
    );
  };

  const totalRecipients = selected.size + pastedPhones.length;
  const canSend = totalRecipients > 0 && body.trim().length > 0 &&
    (channel === 'sms' || templateName.trim().length > 0) && !sending;

  const submit = async () => {
    setSending(true);
    setErr(null);
    try {
      const recipientsFromList = customers
        .filter((c) => selected.has(c.phone))
        .map((c) => ({ phone: c.phone, customerName: c.name ?? undefined }));
      const recipientsFromPaste = pastedPhones
        .filter((p) => !recipientsFromList.some((r) => r.phone === p))
        .map((p) => ({ phone: p }));
      const recipients = [...recipientsFromList, ...recipientsFromPaste];
      const campaign = await api<Campaign>('/notifications/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          channel,
          body,
          templateName: channel === 'whatsapp' ? templateName : undefined,
          templateLanguage: channel === 'whatsapp' ? templateLanguage : undefined,
          recipients,
        }),
      });
      setSent(campaign);
      setBody('');
      setSelected(new Set());
      setPasted('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-2 divide-x divide-white/[0.06] overflow-hidden">
      {/* LEFT — recipient picker */}
      <div className="overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-white/60 uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4" />
            Recipients ({totalRecipients})
          </div>
          {customers.length > 0 && (
            <button onClick={toggleAll} className="text-[11px] text-indigo-300 hover:text-indigo-200 font-bold">
              {selected.size === customers.length ? 'Clear' : 'Select all'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-white/40 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
            Loading customer list…
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-xs italic">
            No customers with phone numbers yet — paste recipients below.
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {customers.map((c) => (
              <label
                key={c.phone}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border ${
                  selected.has(c.phone) ? 'bg-indigo-500/15 border-indigo-500/30' : 'border-transparent hover:bg-white/[0.03]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.phone)}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(c.phone);
                      else next.delete(c.phone);
                      return next;
                    });
                  }}
                  className="accent-indigo-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{c.name || 'No name'}</div>
                  <div className="text-[10px] text-white/40">{c.phone}</div>
                </div>
                <div className="text-right text-[10px]">
                  <div className="text-white/80 font-bold">{c.orderCount} order{c.orderCount === 1 ? '' : 's'}</div>
                  <div className="text-white/40">{fmtMoney(c.totalSpent)}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div>
          <div className="text-[10px] text-white/40 uppercase font-bold tracking-wide mb-1">
            Or paste extra phones
          </div>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="0712345678, 0734…
or one per line"
            className="w-full h-20 px-3 py-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs text-white placeholder-white/30"
          />
          {pastedPhones.length > 0 && (
            <div className="text-[10px] text-emerald-400 mt-1">+{pastedPhones.length} pasted recipient{pastedPhones.length === 1 ? '' : 's'}</div>
          )}
        </div>
      </div>

      {/* RIGHT — message composer */}
      <div className="overflow-y-auto p-5 space-y-4">
        <div>
          <div className="text-xs font-bold text-white/60 uppercase tracking-wide mb-1.5">Channel</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setChannel('sms')}
              className={`h-10 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-2 ${
                channel === 'sms' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-100' : 'border-white/[0.08] text-white/60 hover:bg-white/[0.03]'
              }`}
            >
              <Phone className="w-4 h-4" /> SMS
            </button>
            <button
              onClick={() => setChannel('whatsapp')}
              className={`h-10 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-2 ${
                channel === 'whatsapp' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100' : 'border-white/[0.08] text-white/60 hover:bg-white/[0.03]'
              }`}
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>
          </div>
          {channel === 'whatsapp' && (
            <p className="text-[10px] text-amber-300/80 mt-2 leading-relaxed">
              ⚠ WhatsApp Business sends require a Meta-approved template under your Beem sender. Enter the
              exact template name + language below. Free-text WhatsApp only works in the 24h customer-initiated
              session window.
            </p>
          )}
        </div>

        {channel === 'whatsapp' && (
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <div className="text-xs font-bold text-white/60 uppercase tracking-wide mb-1.5">Template name</div>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. promo_weekend_sale"
                className="w-full h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs text-white"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-white/60 uppercase tracking-wide mb-1.5">Lang</div>
              <input
                value={templateLanguage}
                onChange={(e) => setTemplateLanguage(e.target.value)}
                placeholder="en"
                className="w-full h-9 px-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs text-white"
              />
            </div>
          </div>
        )}

        <div>
          <div className="text-xs font-bold text-white/60 uppercase tracking-wide mb-1.5">
            {channel === 'sms' ? 'SMS body' : 'Template body preview'}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={channel === 'sms'
              ? 'Hello! Our weekend sale is on — 20% off all caps.'
              : 'Hello {{1}}, your order {{2}} is ready for collection.'}
            className="w-full h-36 px-3 py-2 rounded-lg bg-[#06060f] border border-white/[0.08] text-xs text-white placeholder-white/30 font-mono"
          />
          <div className="text-[10px] text-white/40 mt-1 flex justify-between">
            <span>{body.length} chars{channel === 'sms' && body.length > 160 ? ` · ${Math.ceil(body.length / 160)} SMS segments` : ''}</span>
            {channel === 'whatsapp' && <span>Use {'{{1}}'}, {'{{2}}'} for template variables</span>}
          </div>
        </div>

        {err && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs p-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="flex-1">{err}</span>
          </div>
        )}

        {sent && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 text-xs p-2 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-bold">Campaign created — sending in background</div>
              <div className="text-[10px] text-emerald-200/80 mt-0.5">
                {sent.recipientCount} recipient{sent.recipientCount === 1 ? '' : 's'}. Open History tab to watch progress.
              </div>
            </div>
            <button onClick={() => setSent(null)}><XCircle className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSend}
          className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/[0.08] disabled:text-white/40 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Sending…' : `Send to ${totalRecipients} recipient${totalRecipients === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}

function HistoryView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(Campaign & { messages: CampaignMessage[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const list = await api<Campaign[]>('/notifications/campaigns');
      if (Array.isArray(list)) setCampaigns(list);
    } catch { /* show empty */ }
  }, []);

  useEffect(() => { void reload().then(() => setLoading(false)); }, [reload]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    const tick = async () => {
      try {
        const d = await api<Campaign & { messages: CampaignMessage[] }>(`/notifications/campaigns/${selectedId}`);
        if (!cancelled) setDetail(d);
      } catch { /* ignore */ }
    };
    void tick();
    // Poll while the campaign is still sending.
    const id = setInterval(() => {
      if (detail && (detail.status === 'COMPLETED' || detail.status === 'FAILED')) return;
      void tick();
    }, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selectedId, detail]);

  const retry = async () => {
    if (!selectedId) return;
    try {
      await api(`/notifications/campaigns/${selectedId}/retry`, { method: 'POST' });
      await reload();
    } catch { /* show error toast next iteration */ }
  };

  if (loading) {
    return (
      <div className="h-full grid place-items-center text-white/40 text-xs">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-2 divide-x divide-white/[0.06] overflow-hidden">
      <div className="overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-xs font-bold text-white/60 uppercase tracking-wide">Campaigns</span>
          <button onClick={reload} className="text-white/40 hover:text-white/80"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-xs text-white/40 italic text-center py-12">No campaigns yet.</p>
        ) : (
          campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedId === c.id ? 'bg-indigo-500/15 border-indigo-500/30' : 'border-white/[0.06] hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold inline-flex items-center gap-1.5">
                  {c.channel === 'whatsapp' ? <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Phone className="w-3.5 h-3.5 text-indigo-400" />}
                  {c.channel === 'whatsapp' ? (c.templateName || '(no template)') : 'SMS'}
                </span>
                <StatusBadge status={c.status} />
              </div>
              <div className="text-[10px] text-white/50 mt-1 truncate">{c.body.slice(0, 80)}</div>
              <div className="text-[10px] text-white/40 mt-1 flex justify-between">
                <span>{c.recipientCount} recipient{c.recipientCount === 1 ? '' : 's'}</span>
                <span>
                  {c.sentCount} sent
                  {c.failedCount > 0 && <span className="text-rose-400"> · {c.failedCount} failed</span>}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="overflow-y-auto p-4">
        {!detail ? (
          <div className="h-full grid place-items-center text-white/30 text-xs italic">
            Pick a campaign to see per-recipient status
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="text-sm font-extrabold">
                  {detail.channel === 'whatsapp' ? `WhatsApp · ${detail.templateName}` : 'SMS'}
                </div>
                <div className="text-[10px] text-white/40">
                  {new Date(detail.createdAt).toLocaleString()}
                </div>
              </div>
              {detail.failedCount > 0 && (
                <button
                  onClick={retry}
                  className="px-2 h-7 rounded-md bg-amber-500/20 text-amber-200 text-[10px] font-bold inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Retry {detail.failedCount} failed
                </button>
              )}
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 mb-3">
              <div className="text-[10px] text-white/40 mb-1 uppercase font-bold">Body</div>
              <div className="text-xs text-white/90 whitespace-pre-wrap font-mono">{detail.body}</div>
            </div>
            <div className="text-xs font-bold text-white/60 uppercase tracking-wide mb-2">
              Recipients ({detail.messages.length})
            </div>
            <div className="space-y-1">
              {detail.messages.map((m) => (
                <div key={m.id} className="text-xs flex items-center gap-2 p-2 rounded border border-white/[0.04] bg-white/[0.02]">
                  {m.status === 'SENT'   && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {m.status === 'FAILED' && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  {m.status === 'PENDING' && <Loader2 className="w-4 h-4 text-white/40 animate-spin shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{m.customerName || m.phone}</div>
                    <div className="text-[10px] text-white/50 truncate">{m.phone}</div>
                  </div>
                  {m.error && <div className="text-[10px] text-rose-300 max-w-[40%] truncate" title={m.error}>{m.error}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const tone =
    status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
    status === 'FAILED'    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'         :
    status === 'SENDING'   ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'      :
                             'bg-white/[0.05] text-white/60 border-white/[0.08]';
  return (
    <span className={`text-[9px] font-bold uppercase border px-1.5 py-0.5 rounded ${tone}`}>
      {status}
    </span>
  );
}
