import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';

type Frequency = 'HOURLY' | 'DAILY' | 'WEEKLY';
type ApprovalMode = 'AUTOMATIC' | 'APPROVAL_REQUIRED' | 'DRAFT_ONLY';
type AgentStatus = 'ACTIVE' | 'PAUSED' | 'RUNNING' | 'ERROR';
type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'AWAITING_APPROVAL' | 'FAILED' | 'SKIPPED';

interface ScheduledAgent {
  id: string;
  name: string;
  objective: string;
  frequency: Frequency;
  timeOfDay: string;
  intervalHours: number;
  daysOfWeek: number[];
  timezone: string;
  allowedModules: string[];
  allowedTools: string[];
  approvalMode: ApprovalMode;
  inputSources: string[];
  outputDestination: 'KOBEOS_INBOX' | 'SMS_OWNER' | 'DRAFT_ONLY';
  status: AgentStatus;
  nextRunAt: string;
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  consecutiveFailures: number;
  lastError: string;
}

interface AgentRun {
  id: string;
  agentId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string | null;
  summary: string;
  result: Record<string, unknown>;
  pendingAction?: { tool: string; summary: string; args: Record<string, unknown> } | null;
  error: string;
  wasAutomaticAction: boolean;
}

interface Metadata {
  modules: string[];
  writeTools: string[];
  approvalModes: ApprovalMode[];
  frequencies: Frequency[];
  outputs: string[];
}

interface AiHealth {
  running: boolean;
  models: string[];
  activeModel: string;
  latencyMs: number | null;
  queueDepth: number;
  lastError: string;
  circuitOpenUntil: string | null;
}

const field = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100';
const label = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500';
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const templates = [
  { name: 'Daily low-stock report', objective: 'Review current inventory and produce a concise low-stock and out-of-stock report with the most urgent restocking actions.', modules: ['inventory', 'erp'], tools: [] },
  { name: 'Hotel arrivals brief', objective: 'Summarize today’s hotel arrivals, room readiness, unpaid balances, and operational exceptions for management.', modules: ['hotel', 'reports'], tools: [] },
  { name: 'Cargo exception monitor', objective: 'Find delayed, overdue, or exceptional cargo parcels and prepare a clear follow-up list for the operations team.', modules: ['cargo', 'reports'], tools: [] },
  { name: 'Rent collection assistant', objective: 'Review unpaid rent charges, summarize overdue tenants, and draft appropriate tenant reminder messages.', modules: ['property', 'payments'], tools: ['send_tenant_notification'] },
  { name: 'Daily sales reconciliation', objective: 'Summarize daily sales, payment methods, refunds, expenses, and any reconciliation differences that require attention.', modules: ['erp', 'payments', 'reports'], tools: [] },
];

export default function KobeAgentsApp() {
  const [agents, setAgents] = useState<ScheduledAgent[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [template, setTemplate] = useState<(typeof templates)[number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'agents' | 'runs'>('agents');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [agentRows, runRows, meta, runtime] = await Promise.all([
        api<ScheduledAgent[]>('/ai/agents'),
        api<AgentRun[]>('/ai/agents/runs'),
        api<Metadata>('/ai/agents/metadata'),
        api<AiHealth>('/ai/health'),
      ]);
      setAgents(Array.isArray(agentRows) ? agentRows : []);
      setRuns(Array.isArray(runRows) ? runRows : []);
      setMetadata(meta);
      setHealth(runtime);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load Kobe Agents.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? null, [agents, selectedId]);
  const selectedRuns = useMemo(() => selected ? runs.filter((run) => run.agentId === selected.id) : runs, [runs, selected]);
  const awaiting = runs.filter((run) => run.status === 'AWAITING_APPROVAL').length;

  const action = async (agent: ScheduledAgent, kind: 'pause' | 'resume' | 'test' | 'delete') => {
    setBusyId(agent.id); setError(null);
    try {
      if (kind === 'delete') {
        if (!window.confirm(`Delete agent “${agent.name}” and keep its audit history?`)) return;
        await api(`/ai/agents/${agent.id}`, { method: 'DELETE' });
      } else {
        await api(`/ai/agents/${agent.id}/${kind}`, { method: 'POST', body: kind === 'test' ? JSON.stringify({ executeAutomaticAction: false }) : undefined });
      }
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Could not ${kind} agent.`); }
    finally { setBusyId(null); }
  };

  const decide = async (run: AgentRun, decision: 'approve' | 'reject') => {
    setBusyId(run.id); setError(null);
    try { await api(`/ai/agents/runs/${run.id}/${decision}`, { method: 'POST' }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : `Could not ${decision} action.`); }
    finally { setBusyId(null); }
  };

  const create = async (payload: Record<string, unknown>) => {
    setBusyId('create'); setError(null);
    try {
      const created = await api<ScheduledAgent>('/ai/agents', { method: 'POST', body: JSON.stringify(payload) });
      setShowCreate(false); setTemplate(null); setSelectedId(created.id); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create agent.'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100 text-slate-900">
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white"><Bot className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><h1 className="font-extrabold">Kobe Agents</h1><p className="text-[11px] text-slate-500">Scheduled AI work with explicit permissions, approvals, retries, and audit logs</p></div>
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-extrabold ${health?.running ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}><Activity className="h-3.5 w-3.5" />{health?.running ? `${health.activeModel} · ${health.latencyMs ?? '—'}ms` : 'AI runtime offline'}</div>
          <button onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => { setTemplate(null); setShowCreate(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-xs font-extrabold text-white hover:bg-violet-500"><Plus className="h-3.5 w-3.5" />Create agent</button>
        </div>
        <div className="mt-3 flex items-center gap-1"><button onClick={() => setView('agents')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === 'agents' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Agents</button><button onClick={() => setView('runs')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === 'runs' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Run history {awaiting > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-slate-900">{awaiting}</span>}</button></div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-5">
        {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><AlertCircle className="h-4 w-4" />{error}</div>}
        {!health?.running && !loading && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 font-extrabold text-amber-800"><AlertCircle className="h-4 w-4" />Kobe AI runtime needs attention</div><p className="mt-1 text-xs text-amber-700">Start Ollama and install a recommended chat model. Scheduled agents retain their next-run state and retry safely after the runtime returns.</p>{health?.lastError && <div className="mt-2 font-mono text-[10px] text-amber-600">{health.lastError}</div>}</div>}

        {view === 'agents' && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section>
              {!agents.length && !loading ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Sparkles className="mx-auto h-10 w-10 text-violet-300" /><h2 className="mt-3 font-extrabold">Create your first Kobe Agent</h2><p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">Choose a template or define exactly what the agent may read, when it runs, and whether an action requires approval.</p><div className="mt-5 grid gap-2 md:grid-cols-2">{templates.map((item) => <button key={item.name} onClick={() => { setTemplate(item); setShowCreate(true); }} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-violet-300 hover:bg-violet-50"><div className="text-sm font-extrabold">{item.name}</div><div className="mt-1 line-clamp-2 text-xs text-slate-500">{item.objective}</div></button>)}</div></div> : null}
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{agents.map((agent) => <article key={agent.id} onClick={() => setSelectedId(agent.id)} className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition ${selectedId === agent.id ? 'border-violet-500 ring-2 ring-violet-100' : 'border-slate-200 hover:border-violet-300'}`}><div className="flex items-start gap-3"><div className={`grid h-10 w-10 place-items-center rounded-xl ${agent.status === 'ACTIVE' ? 'bg-violet-50 text-violet-600' : agent.status === 'ERROR' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}><Bot className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate font-extrabold">{agent.name}</div><div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500"><Clock3 className="h-3 w-3" />{scheduleText(agent)}</div></div><AgentStatusPill status={agent.status} /></div><p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-600">{agent.objective}</p><div className="mt-3 flex flex-wrap gap-1">{agent.allowedModules.slice(0, 4).map((module) => <span key={module} className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold capitalize text-slate-500">{module}</span>)}<span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${agent.approvalMode === 'AUTOMATIC' ? 'bg-rose-50 text-rose-600' : agent.approvalMode === 'APPROVAL_REQUIRED' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>{agent.approvalMode.replaceAll('_', ' ')}</span></div><div className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">Next: {new Date(agent.nextRunAt).toLocaleString()}</div></article>)}</div>
            </section>
            <AgentDetail agent={selected} runs={selectedRuns} busyId={busyId} onAction={action} />
          </div>
        )}

        {view === 'runs' && <RunTable runs={runs} busyId={busyId} onDecide={decide} agents={agents} />}
      </main>

      {showCreate && metadata && <AgentForm metadata={metadata} template={template} saving={busyId === 'create'} onClose={() => { setShowCreate(false); setTemplate(null); }} onSave={create} />}
    </div>
  );
}

function AgentForm({ metadata, template, saving, onClose, onSave }: { metadata: Metadata; template: (typeof templates)[number] | null; saving: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(template?.name ?? '');
  const [objective, setObjective] = useState(template?.objective ?? '');
  const [frequency, setFrequency] = useState<Frequency>('DAILY');
  const [timeOfDay, setTimeOfDay] = useState('08:00');
  const [intervalHours, setIntervalHours] = useState(24);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timezone, setTimezone] = useState('Africa/Dar_es_Salaam');
  const [modules, setModules] = useState<string[]>(template?.modules ?? ['reports']);
  const [tools, setTools] = useState<string[]>(template?.tools ?? []);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(template?.tools.length ? 'APPROVAL_REQUIRED' : 'DRAFT_ONLY');
  const [output, setOutput] = useState('KOBEOS_INBOX');
  const submit = (event: FormEvent) => { event.preventDefault(); void onSave({ name, objective, frequency, timeOfDay, intervalHours, daysOfWeek: frequency === 'WEEKLY' ? days : [], timezone, allowedModules: modules, allowedTools: tools, approvalMode, inputSources: modules, outputDestination: output, enabled: true }); };
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 p-4"><div className="mx-auto my-4 w-full max-w-3xl rounded-3xl bg-white shadow-2xl"><div className="flex items-start gap-3 border-b border-slate-200 p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-600"><Bot className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="font-extrabold">Create scheduled agent</h2><p className="text-xs text-slate-500">Nothing runs outside the modules and tools selected below.</p></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100"><XCircle className="h-4 w-4" /></button></div><form onSubmit={submit} className="space-y-5 p-5"><div className="grid gap-3 md:grid-cols-2"><label><span className={label}>Agent name</span><input required value={name} onChange={(e) => setName(e.target.value)} className={field} /></label><label><span className={label}>Timezone</span><input required value={timezone} onChange={(e) => setTimezone(e.target.value)} className={field} placeholder="Africa/Dar_es_Salaam" /></label></div><label><span className={label}>Objective</span><textarea required rows={4} value={objective} onChange={(e) => setObjective(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-violet-500" /></label><div className="grid gap-3 md:grid-cols-3"><label><span className={label}>Frequency</span><select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={field}>{metadata.frequencies.map((item) => <option key={item}>{item}</option>)}</select></label>{frequency === 'HOURLY' ? <label><span className={label}>Every hours</span><input type="number" min={1} max={168} value={intervalHours} onChange={(e) => setIntervalHours(Number(e.target.value))} className={field} /></label> : <label><span className={label}>Run time</span><input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className={field} /></label>}<label><span className={label}>Approval mode</span><select value={approvalMode} onChange={(e) => setApprovalMode(e.target.value as ApprovalMode)} className={field}><option value="DRAFT_ONLY">Draft only</option><option value="APPROVAL_REQUIRED">Approval required</option><option value="AUTOMATIC">Automatic allowed tools</option></select></label></div>{frequency === 'WEEKLY' && <div><span className={label}>Weekdays</span><div className="flex flex-wrap gap-2">{weekdays.map((day, index) => <button type="button" key={day} onClick={() => setDays((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} className={`h-9 rounded-xl border px-3 text-xs font-bold ${days.includes(index) ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500'}`}>{day}</button>)}</div></div>}<Selector title="Allowed modules" values={metadata.modules} selected={modules} onChange={setModules} /><Selector title="Write tools (only these can change business data)" values={metadata.writeTools} selected={tools} onChange={setTools} /><label><span className={label}>Output destination</span><select value={output} onChange={(e) => setOutput(e.target.value)} className={field}>{metadata.outputs.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>{approvalMode === 'AUTOMATIC' && tools.length > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><b>Automatic action permission:</b> this agent may execute only the selected write tools without asking each time. Every execution is recorded.</div>}<button disabled={saving || !modules.length} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 font-extrabold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Create agent</button></form></div></div>;
}

function Selector({ title, values, selected, onChange }: { title: string; values: string[]; selected: string[]; onChange: (values: string[]) => void }) { return <div><span className={label}>{title}</span><div className="flex flex-wrap gap-2">{values.map((value) => { const active = selected.includes(value); return <button type="button" key={value} onClick={() => onChange(active ? selected.filter((item) => item !== value) : [...selected, value])} className={`rounded-xl border px-3 py-1.5 text-[10px] font-bold ${active ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500'}`}>{value.replaceAll('_', ' ')}</button>; })}</div></div>; }
function AgentDetail({ agent, runs, busyId, onAction }: { agent: ScheduledAgent | null; runs: AgentRun[]; busyId: string | null; onAction: (agent: ScheduledAgent, action: 'pause' | 'resume' | 'test' | 'delete') => Promise<void> }) { if (!agent) return <aside className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-400">Select an agent to see permissions, schedule, and recent runs.</aside>; const busy = busyId === agent.id; return <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-600"><Bot className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="font-extrabold">{agent.name}</div><div className="text-[10px] text-slate-500">{scheduleText(agent)}</div></div><AgentStatusPill status={agent.status} /></div><p className="mt-4 text-xs leading-relaxed text-slate-600">{agent.objective}</p><div className="mt-4 grid grid-cols-2 gap-2"><Mini label="Next run" value={new Date(agent.nextRunAt).toLocaleString()} /><Mini label="Last success" value={agent.lastSuccessAt ? new Date(agent.lastSuccessAt).toLocaleString() : 'Never'} /><Mini label="Approval" value={agent.approvalMode.replaceAll('_', ' ')} /><Mini label="Failures" value={String(agent.consecutiveFailures)} /></div><div className="mt-3"><div className="text-[9px] font-bold uppercase text-slate-400">Allowed tools</div><div className="mt-1 text-xs text-slate-600">{agent.allowedTools.length ? agent.allowedTools.join(', ') : 'Read-only'}</div></div>{agent.lastError && <div className="mt-3 rounded-xl bg-rose-50 p-2 text-[10px] text-rose-700">{agent.lastError}</div>}<div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => void onAction(agent, 'test')} disabled={busy} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-violet-600 text-xs font-bold text-white"><Zap className="h-3.5 w-3.5" />Test run</button><button onClick={() => void onAction(agent, agent.status === 'PAUSED' || agent.status === 'ERROR' ? 'resume' : 'pause')} disabled={busy} className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-300 text-xs font-bold">{agent.status === 'PAUSED' || agent.status === 'ERROR' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{agent.status === 'PAUSED' || agent.status === 'ERROR' ? 'Resume' : 'Pause'}</button></div><button onClick={() => void onAction(agent, 'delete')} disabled={busy} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-rose-50 text-xs font-bold text-rose-700"><Trash2 className="h-3.5 w-3.5" />Delete agent</button><div className="mt-4 border-t border-slate-100 pt-3"><div className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400"><History className="h-3 w-3" />Recent runs</div>{runs.slice(0, 5).map((run) => <div key={run.id} className="mb-2 rounded-xl bg-slate-50 p-2"><div className="flex items-center justify-between gap-2"><RunStatusPill status={run.status} /><span className="text-[9px] text-slate-400">{new Date(run.startedAt).toLocaleString()}</span></div><div className="mt-1 line-clamp-2 text-[10px] text-slate-600">{run.summary || run.error}</div></div>)}{!runs.length && <div className="text-xs text-slate-400">No runs yet.</div>}</div></aside>; }
function RunTable({ runs, agents, busyId, onDecide }: { runs: AgentRun[]; agents: ScheduledAgent[]; busyId: string | null; onDecide: (run: AgentRun, decision: 'approve' | 'reject') => Promise<void> }) { const names = new Map(agents.map((agent) => [agent.id, agent.name])); return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Started</th><th className="p-3">Agent</th><th className="p-3">Status</th><th className="p-3">Result</th><th className="p-3">Action</th><th className="p-3"></th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t border-slate-100 align-top"><td className="p-3 whitespace-nowrap">{new Date(run.startedAt).toLocaleString()}</td><td className="p-3 font-bold">{names.get(run.agentId) || 'Deleted agent'}</td><td className="p-3"><RunStatusPill status={run.status} /></td><td className="max-w-md p-3 text-slate-600">{run.summary || run.error || '—'}</td><td className="p-3">{run.pendingAction ? <div><div className="font-mono text-[10px] font-bold text-violet-700">{run.pendingAction.tool}</div><div className="mt-1 max-w-xs text-[10px] text-slate-500">{run.pendingAction.summary}</div></div> : run.wasAutomaticAction ? <span className="text-[10px] font-bold text-rose-600">Automatic action recorded</span> : '—'}</td><td className="p-3">{run.status === 'AWAITING_APPROVAL' && <div className="flex gap-1"><button onClick={() => void onDecide(run, 'approve')} disabled={busyId === run.id} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[10px] font-bold text-white"><CheckCircle2 className="h-3 w-3" />Approve</button><button onClick={() => void onDecide(run, 'reject')} disabled={busyId === run.id} className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-50 px-2 text-[10px] font-bold text-rose-700"><XCircle className="h-3 w-3" />Reject</button></div>}</td></tr>)}</tbody></table></div>{!runs.length && <div className="p-10 text-center text-sm text-slate-400">No agent runs yet.</div>}</section>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-2.5"><div className="text-[9px] font-bold uppercase text-slate-400">{label}</div><div className="mt-0.5 text-[10px] font-extrabold text-slate-700">{value}</div></div>; }
function AgentStatusPill({ status }: { status: AgentStatus }) { const cls = status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : status === 'ERROR' ? 'bg-rose-50 text-rose-700' : status === 'RUNNING' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'; return <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${cls}`}>{status}</span>; }
function RunStatusPill({ status }: { status: RunStatus }) { const cls = status === 'SUCCEEDED' ? 'bg-emerald-50 text-emerald-700' : status === 'AWAITING_APPROVAL' ? 'bg-amber-50 text-amber-700' : status === 'FAILED' ? 'bg-rose-50 text-rose-700' : status === 'RUNNING' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'; return <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${cls}`}>{status.replaceAll('_', ' ')}</span>; }
function scheduleText(agent: ScheduledAgent) { if (agent.frequency === 'HOURLY') return `Every ${agent.intervalHours} hour${agent.intervalHours === 1 ? '' : 's'} · ${agent.timezone}`; if (agent.frequency === 'WEEKLY') return `${agent.daysOfWeek.map((day) => weekdays[day]).join(', ')} at ${agent.timeOfDay} · ${agent.timezone}`; return `Daily at ${agent.timeOfDay} · ${agent.timezone}`; }
