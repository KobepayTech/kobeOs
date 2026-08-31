import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, Phone, RefreshCw, Users } from 'lucide-react';
import { api } from '@/lib/api';

type CrmStage = 'NEW' | 'CONTACTED' | 'APPOINTMENT' | 'NEGOTIATING' | 'DEPOSIT' | 'WON' | 'LOST';
interface CrmLead {
  id: string;
  businessId?: string | null;
  source: string;
  sourceRefId: string;
  customerName: string;
  customerPhone: string;
  customerWhatsapp: string;
  customerEmail: string;
  subject: string;
  stage: CrmStage;
  value: number | string;
  currency: string;
  assignedTo: string;
  nextActionAt?: string | null;
  notes: string;
  metadata: Record<string, unknown>;
  updatedAt: string;
}
interface CrmSummary {
  total: number;
  open: number;
  pipelineValue: number;
  byStage: Record<CrmStage, number>;
}

const STAGES: CrmStage[] = ['NEW', 'CONTACTED', 'APPOINTMENT', 'NEGOTIATING', 'DEPOSIT', 'WON', 'LOST'];
const openStages: CrmStage[] = ['NEW', 'CONTACTED', 'APPOINTMENT', 'NEGOTIATING', 'DEPOSIT'];

export default function CrmPanel({ source, businessId, compact = false }: { source?: string; businessId?: string; compact?: boolean }) {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (source) params.set('source', source);
      if (businessId) params.set('businessId', businessId);
      const [rows, totals] = await Promise.all([
        api<CrmLead[]>(`/erp/crm/leads${params.toString() ? `?${params.toString()}` : ''}`, { offlineFallback: false }),
        api<CrmSummary>('/erp/crm/summary', { offlineFallback: false }),
      ]);
      setLeads(rows);
      setSummary(totals);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setLoading(false); }
  }, [source, businessId]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => compact ? leads.filter((lead) => openStages.includes(lead.stage)).slice(0, 40) : leads, [leads, compact]);

  const move = async (lead: CrmLead, stage: CrmStage) => {
    setBusy(lead.id); setError('');
    try {
      await api(`/erp/crm/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ stage }), offlineFallback: false });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(''); }
  };

  return <section className="rounded-2xl bg-white border p-5">
    <div className="flex items-start gap-3">
      <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-800 grid place-items-center"><Users className="h-5 w-5" /></div>
      <div><h2 className="text-xl font-black">ERP CRM</h2><p className="text-sm text-slate-500">Shared customer pipeline across KobeOS. Vehicle enquiries are inserted here automatically.</p></div>
      <button onClick={() => void load()} className="ml-auto h-9 w-9 rounded-xl bg-slate-100 grid place-items-center" aria-label="Refresh CRM"><RefreshCw className="h-4 w-4" /></button>
    </div>

    {summary && <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
      <CrmStat label="All leads" value={summary.total.toLocaleString()} />
      <CrmStat label="Open" value={summary.open.toLocaleString()} />
      <CrmStat label="Appointments" value={String(summary.byStage?.APPOINTMENT ?? 0)} />
      <CrmStat label="Won" value={String(summary.byStage?.WON ?? 0)} />
    </div>}

    {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="h-32 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div> :
      visible.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {visible.map((lead) => <article key={lead.id} className="rounded-2xl border p-4">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1"><b className="block truncate">{lead.customerName}</b><p className="truncate text-xs text-slate-500">{lead.subject}</p></div>
            <select disabled={busy === lead.id} value={lead.stage} onChange={(event) => void move(lead, event.target.value as CrmStage)} className="h-8 rounded-lg border px-2 text-[11px] font-black">
              {STAGES.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {lead.customerPhone && <a href={`tel:${lead.customerPhone}`} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1"><Phone className="h-3 w-3" />{lead.customerPhone}</a>}
            {lead.nextActionAt && <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-amber-800"><CalendarClock className="h-3 w-3" />{new Date(lead.nextActionAt).toLocaleString()}</span>}
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-800">{lead.source}</span>
          </div>
          {lead.notes && <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{lead.notes}</p>}
        </article>)}
      </div> : <div className="py-14 text-center text-slate-400"><Users className="h-8 w-8 mx-auto mb-2" /><b>No CRM leads yet</b></div>}
  </section>;
}
function CrmStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><small className="text-slate-500">{label}</small><b className="block text-xl">{value}</b></div>;
}
