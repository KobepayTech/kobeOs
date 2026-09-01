import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Brain, CheckCircle2, Gauge, LayoutDashboard, Loader2, PackageCheck,
  RefreshCw, ShieldCheck, Sparkles, Workflow, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Summary {
  installedSkillPacks: number; availableSkillPacks: number; workflows: number; pendingApprovals: number;
  memoryNodes: number; dashboards: number; openInsights: number; auditEvents: number; indexedBusinessRecords: number;
}
interface SkillPack {
  id: string; name: string; description: string; domains: string[]; skills: string[]; installed: boolean;
}
interface WorkflowPlan {
  id: string; title: string; objective: string; status: string; riskLevel: string; confidence: number;
  steps: Array<{ id: string; title: string; type: string; status: string }>;
}
interface Approval {
  id: string; summary: string; actionType: string; status: string;
  chain: Array<{ role: string; label: string; status: string }>;
}
interface Insight { id: string; severity: string; title: string; summary: string; status: string }
interface MemoryGraph { nodes: Array<{ id: string; nodeType: string; label: string; confidence: number; source: string }>; edges: unknown[] }
interface Dashboard { id: string; name: string; widgets: Array<{ id?: string; title?: string; source?: string; visualization?: string }> }
interface AuditEvent { id: string; eventType: string; module: string; action: string; tool: string; confidence: number; createdAt: string }

type Section = 'overview' | 'skills' | 'workflows' | 'approvals' | 'memory' | 'insights' | 'dashboards' | 'audit';

const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

export default function OperatingControl() {
  const [section, setSection] = useState<Section>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [skills, setSkills] = useState<SkillPack[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowPlan[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [memory, setMemory] = useState<MemoryGraph>({ nodes: [], edges: [] });
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [workflowText, setWorkflowText] = useState('');
  const [dashboardText, setDashboardText] = useState('');
  const [simulation, setSimulation] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, sk, wf, ap, ins, mem, dash, au] = await Promise.all([
        api<Summary>('/ai/operating/summary'),
        api<SkillPack[]>('/ai/operating/skills'),
        api<WorkflowPlan[]>('/ai/operating/workflows'),
        api<Approval[]>('/ai/operating/approvals'),
        api<Insight[]>('/ai/operating/insights'),
        api<MemoryGraph>('/ai/operating/memory'),
        api<Dashboard[]>('/ai/operating/dashboards'),
        api<AuditEvent[]>('/ai/operating/audit'),
      ]);
      setSummary(s); setSkills(sk || []); setWorkflows(wf || []); setApprovals(ap || []);
      setInsights(ins || []); setMemory(mem || { nodes: [], edges: [] }); setDashboards(dash || []); setAudit(au || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load AI operating controls.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, run: () => Promise<unknown>) => {
    setBusy(key); setError('');
    try { await run(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Action failed.'); }
    finally { setBusy(''); }
  };

  const pending = useMemo(() => approvals.filter((item) => item.status === 'PENDING'), [approvals]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([
          ['overview', 'Overview'], ['skills', 'Skill Store'], ['workflows', 'Workflows'], ['approvals', 'Approvals'],
          ['memory', 'Memory'], ['insights', 'Insights'], ['dashboards', 'Dashboards'], ['audit', 'Audit'],
        ] as Array<[Section, string]>).map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)} className={`rounded-xl px-3 py-2 text-xs font-bold ${section === id ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
            {label}{id === 'approvals' && pending.length ? ` (${pending.length})` : ''}
          </button>
        ))}
        <button onClick={() => void load()} className="ml-auto grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}

      {section === 'overview' && <Overview summary={summary} simulation={simulation} onSimulate={() => act('simulate', async () => {
        const result = await api<Record<string, unknown>>('/ai/operating/simulate', { method: 'POST', body: JSON.stringify({ salesChangePct: 10, expenseChangePct: -5, rentCollectionChangePct: 5, roomRateChangePct: 10 }) });
        setSimulation(result);
      })} busy={busy === 'simulate'} />}

      {section === 'skills' && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{skills.map((skill) => (
        <div key={skill.id} className={card}>
          <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><PackageCheck className="h-5 w-5" /></div><div className="min-w-0 flex-1"><b>{skill.name}</b><p className="mt-1 text-xs leading-relaxed text-slate-500">{skill.description}</p></div></div>
          <div className="mt-3 flex flex-wrap gap-1">{skill.domains.map((domain) => <span key={domain} className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">{domain}</span>)}</div>
          <button disabled={busy === skill.id || skill.id === 'core-operator'} onClick={() => act(skill.id, () => api(`/ai/operating/skills/${skill.id}/${skill.installed ? 'uninstall' : 'install'}`, { method: 'POST', body: JSON.stringify({}) }))} className={`mt-3 h-9 w-full rounded-xl text-xs font-extrabold ${skill.installed ? 'bg-slate-100 text-slate-600' : 'bg-violet-600 text-white'} disabled:opacity-40`}>
            {busy === skill.id ? 'Updating…' : skill.installed ? 'Installed' : 'Install skill pack'}
          </button>
        </div>
      ))}</div>}

      {section === 'workflows' && <div className="space-y-3">
        <div className={card}><div className="flex gap-2"><input value={workflowText} onChange={(e) => setWorkflowText(e.target.value)} placeholder="Describe a multi-step job, e.g. prepare month-end accounts" className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm" /><button disabled={!workflowText.trim() || busy === 'new-workflow'} onClick={() => act('new-workflow', async () => { await api('/ai/operating/workflows', { method: 'POST', body: JSON.stringify({ objective: workflowText }) }); setWorkflowText(''); })} className="rounded-xl bg-violet-600 px-4 text-xs font-bold text-white">Create plan</button></div></div>
        {workflows.map((flow) => <div key={flow.id} className={card}><div className="flex flex-wrap items-start gap-3"><Workflow className="h-5 w-5 text-violet-600" /><div className="min-w-0 flex-1"><b>{flow.title}</b><p className="mt-1 text-xs text-slate-500">{flow.objective}</p><div className="mt-2 flex flex-wrap gap-1">{flow.steps.map((step) => <span key={step.id} className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{step.title} · {step.status}</span>)}</div></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">{flow.status} · {Math.round(flow.confidence * 100)}%</span></div><div className="mt-3 flex gap-2">{flow.status === 'APPROVAL_REQUIRED' && <button onClick={() => act(`approve-${flow.id}`, () => api(`/ai/operating/workflows/${flow.id}/approve`, { method: 'POST' }))} className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white">Approve plan</button>}<button onClick={() => act(`run-${flow.id}`, () => api(`/ai/operating/workflows/${flow.id}/run`, { method: 'POST' }))} className="rounded-xl bg-violet-600 px-3 py-2 text-[10px] font-bold text-white">Run / continue</button></div></div>)}
      </div>}

      {section === 'approvals' && <div className="space-y-3">{approvals.map((approval) => <div key={approval.id} className={card}><div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-amber-600" /><div className="flex-1"><b>{approval.summary}</b><div className="mt-1 text-[10px] text-slate-500">{approval.actionType} · {approval.chain.map((s) => `${s.label}: ${s.status}`).join(' → ')}</div></div><b className="text-[10px] text-slate-500">{approval.status}</b></div>{approval.status === 'PENDING' && <div className="mt-3 flex gap-2"><button onClick={() => act(`ap-${approval.id}`, () => api(`/ai/operating/approvals/${approval.id}/decide`, { method: 'POST', body: JSON.stringify({ decision: 'approve' }) }))} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white"><CheckCircle2 className="h-3 w-3" />Approve</button><button onClick={() => act(`rj-${approval.id}`, () => api(`/ai/operating/approvals/${approval.id}/decide`, { method: 'POST', body: JSON.stringify({ decision: 'reject' }) }))} className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-700"><XCircle className="h-3 w-3" />Reject</button></div>}</div>)}</div>}

      {section === 'memory' && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{memory.nodes.map((node) => <div key={node.id} className={card}><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-violet-600" /><b className="text-sm">{node.label}</b></div><div className="mt-2 text-[10px] text-slate-500">{node.nodeType} · {node.source} · {Math.round(node.confidence * 100)}%</div></div>)}</div>}

      {section === 'insights' && <div className="space-y-3"><button onClick={() => act('refresh-insights', () => api('/ai/operating/insights/refresh', { method: 'POST' }))} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white">Refresh business watch</button>{insights.map((insight) => <div key={insight.id} className={card}><div className="flex gap-3"><Activity className={`h-5 w-5 ${insight.severity === 'critical' ? 'text-rose-600' : insight.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'}`} /><div className="flex-1"><b>{insight.title}</b><p className="mt-1 text-xs text-slate-600">{insight.summary}</p></div><span className="text-[9px] font-bold text-slate-400">{insight.status}</span></div></div>)}</div>}

      {section === 'dashboards' && <div className="space-y-3"><div className={card}><div className="flex gap-2"><input value={dashboardText} onChange={(e) => setDashboardText(e.target.value)} placeholder="e.g. revenue, expenses, rent and hotel occupancy" className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm" /><button disabled={!dashboardText.trim()} onClick={() => act('dashboard', async () => { await api('/ai/operating/dashboards', { method: 'POST', body: JSON.stringify({ prompt: dashboardText }) }); setDashboardText(''); })} className="rounded-xl bg-violet-600 px-4 text-xs font-bold text-white">Generate dashboard</button></div></div>{dashboards.map((dash) => <div key={dash.id} className={card}><div className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5 text-violet-600" /><b>{dash.name}</b></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{dash.widgets.map((widget, i) => <div key={widget.id || i} className="rounded-xl bg-slate-50 p-3"><b className="text-xs">{widget.title || 'Metric'}</b><div className="mt-1 text-[10px] text-slate-500">{widget.source} · {widget.visualization}</div></div>)}</div></div>)}</div>}

      {section === 'audit' && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Time</th><th className="p-3">Event</th><th className="p-3">Module</th><th className="p-3">Action / tool</th><th className="p-3">Confidence</th></tr></thead><tbody>{audit.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="p-3">{new Date(row.createdAt).toLocaleString()}</td><td className="p-3 font-bold">{row.eventType}</td><td className="p-3">{row.module || '—'}</td><td className="p-3">{row.tool || row.action || '—'}</td><td className="p-3">{Math.round((row.confidence || 0) * 100)}%</td></tr>)}</tbody></table></div>}
    </div>
  );
}

function Overview({ summary, simulation, onSimulate, busy }: { summary: Summary | null; simulation: Record<string, unknown> | null; onSimulate: () => void; busy: boolean }) {
  const items = [
    ['Skill packs', summary ? `${summary.installedSkillPacks}/${summary.availableSkillPacks}` : '—', PackageCheck],
    ['Workflows', summary?.workflows ?? '—', Workflow],
    ['Approvals', summary?.pendingApprovals ?? '—', ShieldCheck],
    ['Memory nodes', summary?.memoryNodes ?? '—', Brain],
    ['Insights', summary?.openInsights ?? '—', Activity],
    ['Dashboards', summary?.dashboards ?? '—', LayoutDashboard],
    ['Indexed records', summary?.indexedBusinessRecords ?? '—', Sparkles],
    ['Audit events', summary?.auditEvents ?? '—', Gauge],
  ] as const;
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map(([label, value, Icon]) => <div key={label} className={card}><div className="flex items-center gap-2 text-slate-500"><Icon className="h-4 w-4" /><span className="text-[10px] font-bold uppercase">{label}</span></div><div className="mt-2 text-2xl font-black">{value}</div></div>)}</div><div className={card}><div className="flex flex-wrap items-center gap-3"><div className="flex-1"><b>Business simulation</b><p className="mt-1 text-xs text-slate-500">Test a sample +10% sales, −5% expenses, +5% rent collection and +10% room-rate scenario using current KobeOS values.</p></div><button onClick={onSimulate} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}Run scenario</button></div>{simulation && <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-[10px] text-emerald-200">{JSON.stringify(simulation, null, 2)}</pre>}</div></div>;
}
