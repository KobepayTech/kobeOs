import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Camera, CheckCircle2, Loader2, Plus, RefreshCw, Search,
  Shield, Trophy, UserRound, X,
} from 'lucide-react';
import {
  analyticsApi, camerasApi, matchesApi, playersApi, teamsApi,
  type Analytics, type Camera as CameraRow, type Match, type Player, type Team,
} from './api';

type Tab = 'matches' | 'teams' | 'players' | 'analytics' | 'cameras';
const dateTime = (value: string) => new Date(value).toLocaleString();

export default function KobeSports() {
  const [tab, setTab] = useState<Tab>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'match' | 'team' | 'player' | 'camera' | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [m, t, p, c] = await Promise.all([
        matchesApi.list(1, 100), teamsApi.list(1, 100), playersApi.list(1, 200), camerasApi.list(),
      ]);
      setMatches(Array.isArray(m.data) ? m.data : []);
      setTeams(Array.isArray(t.data) ? t.data : []);
      setPlayers(Array.isArray(p.data) ? p.data : []);
      setCameras(Array.isArray(c) ? c : []);
      setSelectedMatchId((current) => current || m.data?.[0]?.id || '');
    } catch (e) {
      setMatches([]); setTeams([]); setPlayers([]); setCameras([]);
      setError((e as Error).message || 'Could not load Kobe Sports.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadAnalytics = useCallback(async (matchId: string) => {
    if (!matchId) { setAnalytics(null); return; }
    setAnalyticsBusy(true); setError('');
    try { setAnalytics(await analyticsApi.forMatch(matchId)); }
    catch { setAnalytics(null); }
    finally { setAnalyticsBusy(false); }
  }, []);

  useEffect(() => { if (tab === 'analytics') void loadAnalytics(selectedMatchId); }, [tab, selectedMatchId, loadAnalytics]);

  const q = search.trim().toLowerCase();
  const visibleMatches = matches.filter((m) => !q || `${m.homeTeam} ${m.awayTeam} ${m.competition ?? ''} ${m.venue ?? ''}`.toLowerCase().includes(q));
  const visibleTeams = teams.filter((t) => !q || `${t.name} ${t.shortName ?? ''} ${t.competition ?? ''} ${t.country ?? ''}`.toLowerCase().includes(q));
  const visiblePlayers = players.filter((p) => !q || `${p.name} ${p.teamName ?? ''} ${p.position ?? ''} ${p.nationality ?? ''}`.toLowerCase().includes(q));
  const liveCount = matches.filter((m) => m.status === 'LIVE' || m.status === 'HT').length;

  const lifecycle = async (match: Match, action: 'start' | 'halftime' | 'end' | 'postpone') => {
    try {
      if (action === 'start') await matchesApi.start(match.id);
      if (action === 'halftime') await matchesApi.halftime(match.id);
      if (action === 'end') await matchesApi.end(match.id);
      if (action === 'postpone') await matchesApi.postpone(match.id);
      await load();
    } catch (e) { setError((e as Error).message || 'Could not update match.'); }
  };

  const score = async (match: Match) => {
    const home = Number(window.prompt(`${match.homeTeam} score`, String(match.homeScore)));
    if (!Number.isFinite(home) || home < 0) return;
    const away = Number(window.prompt(`${match.awayTeam} score`, String(match.awayScore)));
    if (!Number.isFinite(away) || away < 0) return;
    try { await matchesApi.updateScore(match.id, { homeScore: home, awayScore: away }); await load(); }
    catch (e) { setError((e as Error).message || 'Could not update score.'); }
  };

  const report = async () => {
    if (!selectedMatchId) return;
    setAnalyticsBusy(true); setError('');
    try { await analyticsApi.tacticalReport(selectedMatchId); await loadAnalytics(selectedMatchId); }
    catch (e) { setError((e as Error).message || 'AI tactical report is unavailable.'); }
    finally { setAnalyticsBusy(false); }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-950 text-white overflow-hidden">
      <header className="shrink-0 bg-gray-900 border-b border-gray-800">
        <div className="h-16 px-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-400/15 text-amber-300 grid place-items-center"><Trophy className="h-5 w-5" /></div>
          <div><h1 className="font-black">Kobe Sports</h1><p className="text-[11px] text-gray-500">Real fixtures · teams · players · cameras · match analytics</p></div>
          <button onClick={() => void load()} disabled={loading} className="ml-auto h-9 w-9 rounded-lg border border-gray-700 grid place-items-center text-gray-400 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <nav className="px-3 flex overflow-x-auto">{([['matches','Matches',Trophy],['teams','Teams',Shield],['players','Players',UserRound],['analytics','Analytics',Activity],['cameras','Cameras',Camera]] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`h-11 px-3 inline-flex items-center gap-2 text-xs font-black border-b-2 ${tab === id ? 'text-amber-300 border-amber-300' : 'text-gray-500 border-transparent'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="Matches" value={matches.length} /><Metric label="Live now" value={liveCount} /><Metric label="Teams" value={teams.length} /><Metric label="Players" value={players.length} /></div>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-lg"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sports records…" className="w-full h-10 rounded-xl bg-gray-900 border border-gray-800 pl-9 pr-3 text-sm outline-none focus:border-amber-500/50" /></div>
          {tab !== 'analytics' && <button onClick={() => setModal(tab === 'matches' ? 'match' : tab === 'teams' ? 'team' : tab === 'players' ? 'player' : 'camera')} className="h-10 px-3 rounded-xl bg-amber-500 text-gray-950 text-xs font-black inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add {tab === 'matches' ? 'match' : tab === 'teams' ? 'team' : tab === 'players' ? 'player' : 'camera'}</button>}
        </div>

        {loading && !matches.length && !teams.length && !players.length ? <div className="py-24 grid place-items-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : tab === 'matches' ? <Matches rows={visibleMatches} onAction={lifecycle} onScore={score} onAnalyse={(id) => { setSelectedMatchId(id); setTab('analytics'); }} /> : tab === 'teams' ? <Teams rows={visibleTeams} /> : tab === 'players' ? <Players rows={visiblePlayers} /> : tab === 'cameras' ? <Cameras rows={cameras} matches={matches} onChanged={load} /> : <AnalyticsPanel matches={matches} selectedId={selectedMatchId} setSelectedId={setSelectedMatchId} data={analytics} busy={analyticsBusy} onRefresh={() => loadAnalytics(selectedMatchId)} onReport={report} />}
      </main>
      {modal && <CreateModal mode={modal} teams={teams} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await load(); }} />}
    </div>
  );
}

function Matches({ rows, onAction, onScore, onAnalyse }: { rows: Match[]; onAction: (m: Match, a: 'start'|'halftime'|'end'|'postpone') => Promise<void>; onScore: (m: Match) => Promise<void>; onAnalyse: (id: string) => void }) {
  if (!rows.length) return <Panel><Empty title="No matches" body="Create a fixture. Live scores and analytics will stay attached to that real match." /></Panel>;
  return <Panel><div className="divide-y divide-gray-800">{rows.map((m) => <div key={m.id} className="py-3 flex flex-col lg:flex-row lg:items-center gap-3"><div className="min-w-0 flex-1"><div className="flex gap-2 items-center"><Status value={m.status} /><b className="truncate">{m.homeTeam} vs {m.awayTeam}</b></div><span className="block text-xs text-gray-500 mt-1">{dateTime(m.kickoff)}{m.competition ? ` · ${m.competition}` : ''}{m.venue ? ` · ${m.venue}` : ''}</span></div><button onClick={() => void onScore(m)} className="h-10 min-w-24 rounded-xl bg-gray-900 border border-gray-700 font-black">{m.homeScore} – {m.awayScore}</button><div className="flex flex-wrap gap-1.5 text-xs">{m.status === 'SCHEDULED' && <Action label="Start" onClick={() => void onAction(m,'start')} />}{m.status === 'LIVE' && <Action label="Half time" onClick={() => void onAction(m,'halftime')} />}{(m.status === 'LIVE' || m.status === 'HT') && <Action label="End" onClick={() => void onAction(m,'end')} />}{m.status === 'SCHEDULED' && <Action label="Postpone" onClick={() => void onAction(m,'postpone')} />}<Action label="Analytics" onClick={() => onAnalyse(m.id)} /></div></div>)}</div></Panel>;
}
function Teams({ rows }: { rows: Team[] }) { if (!rows.length) return <Panel><Empty title="No teams" body="Add competing teams to start building fixtures and player rosters." /></Panel>; return <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{rows.map((t) => <div key={t.id} className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4"><div className="flex items-start"><div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-300 grid place-items-center"><Shield className="h-5 w-5" /></div><span className="ml-auto text-[10px] text-gray-500">{t.country || '—'}</span></div><b className="block mt-3">{t.name}</b><span className="text-xs text-gray-500">{t.competition || 'No competition'}{t.stadium ? ` · ${t.stadium}` : ''}</span><div className="grid grid-cols-4 gap-2 mt-4"><Mini label="P" value={t.played} /><Mini label="W" value={t.won} /><Mini label="D" value={t.drawn} /><Mini label="Pts" value={t.points} /></div></div>)}</div>; }
function Players({ rows }: { rows: Player[] }) { if (!rows.length) return <Panel><Empty title="No players" body="Add players and assign them to real teams." /></Panel>; return <Panel><div className="divide-y divide-gray-800">{rows.map((p) => <div key={p.id} className="py-3 flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-gray-800 grid place-items-center font-black text-xs">{p.jerseyNumber ?? p.name.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><span className="text-xs text-gray-500">{p.teamName || 'Unassigned'}{p.position ? ` · ${p.position}` : ''}{p.nationality ? ` · ${p.nationality}` : ''}</span></div><div className="text-right"><b className="text-amber-300">{Number(p.rating || 0).toFixed(1)}</b><span className="block text-[10px] text-gray-600">rating</span></div></div>)}</div></Panel>; }
function Cameras({ rows, matches, onChanged }: { rows: CameraRow[]; matches: Match[]; onChanged: () => Promise<void> }) { const assign = async (c: CameraRow) => { const matchId = window.prompt('Match ID to assign', matches.find((m) => m.status === 'LIVE')?.id || matches[0]?.id || ''); if (!matchId) return; await camerasApi.assign(c.id, matchId); await onChanged(); }; if (!rows.length) return <Panel><Empty title="No cameras" body="Register a camera stream before enabling automated match tracking." /></Panel>; return <Panel><div className="divide-y divide-gray-800">{rows.map((c) => <div key={c.id} className="py-3 flex items-center gap-3"><div className={`h-10 w-10 rounded-xl grid place-items-center ${c.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-800 text-gray-500'}`}><Camera className="h-5 w-5" /></div><div className="flex-1 min-w-0"><b className="block truncate">{c.label}</b><span className="text-xs text-gray-500">{c.role} · {c.status} · {c.fps} fps{c.resolution ? ` · ${c.resolution}` : ''}</span></div><span className="text-[10px] font-black text-gray-500">{c.calibrated ? 'CALIBRATED' : 'NEEDS CALIBRATION'}</span>{c.activeMatchId ? <Action label="Release" onClick={() => void camerasApi.release(c.id).then(onChanged)} /> : <Action label="Assign" onClick={() => void assign(c)} />}</div>)}</div></Panel>; }
function AnalyticsPanel({ matches, selectedId, setSelectedId, data, busy, onRefresh, onReport }: { matches: Match[]; selectedId: string; setSelectedId: (id:string)=>void; data: Analytics|null; busy:boolean; onRefresh:()=>Promise<void>; onReport:()=>Promise<void> }) { const match = matches.find((m) => m.id === selectedId); return <div className="space-y-4"><div className="flex flex-wrap gap-2 items-center"><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="h-10 rounded-xl bg-gray-900 border border-gray-800 px-3 text-sm min-w-72"><option value="">Select match</option>{matches.map((m) => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>)}</select><button onClick={() => void onRefresh()} disabled={!selectedId || busy} className="h-10 px-3 rounded-xl border border-gray-700 text-xs font-black">Refresh</button><button onClick={() => void onReport()} disabled={!selectedId || busy} className="h-10 px-3 rounded-xl bg-amber-500 text-gray-950 text-xs font-black">Generate tactical report</button></div>{busy ? <div className="py-20 grid place-items-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : !selectedId ? <Panel><Empty title="Select a match" body="Analytics is shown only for a real match record." /></Panel> : !data ? <Panel><Empty title="No analytics yet" body="Start tracking or ingest match data, then refresh. No demo statistics are substituted." /></Panel> : <><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="Status" value={data.status} /><Metric label="Home possession" value={data.possession ? `${data.possession.home}%` : '—'} /><Metric label="Away possession" value={data.possession ? `${data.possession.away}%` : '—'} /><Metric label="Match" value={match ? `${match.homeScore}-${match.awayScore}` : '—'} /></div><div className="grid lg:grid-cols-2 gap-4"><Panel><h3 className="font-black">Formation</h3><div className="mt-3 grid grid-cols-2 gap-3"><Mini label={match?.homeTeam || 'Home'} value={data.formations?.home || '—'} /><Mini label={match?.awayTeam || 'Away'} value={data.formations?.away || '—'} /></div></Panel><Panel><h3 className="font-black">xG timeline</h3><div className="mt-3 grid grid-cols-2 gap-3"><Mini label="Home xG" value={data.xgData?.home?.at(-1)?.toFixed(2) ?? '—'} /><Mini label="Away xG" value={data.xgData?.away?.at(-1)?.toFixed(2) ?? '—'} /></div></Panel></div>{data.aiTacticalReport && <Panel><h3 className="font-black">AI tactical report</h3><p className="mt-3 text-sm leading-6 text-gray-300 whitespace-pre-wrap">{data.aiTacticalReport}</p></Panel>}{data.aiCommentary && <Panel><h3 className="font-black">AI commentary</h3><p className="mt-3 text-sm leading-6 text-gray-300 whitespace-pre-wrap">{data.aiCommentary}</p></Panel>}</>}</div>; }
function CreateModal({ mode, teams, onClose, onSaved }: { mode:'match'|'team'|'player'|'camera'; teams:Team[]; onClose:()=>void; onSaved:()=>Promise<void> }) { const [form,setForm]=useState<Record<string,string>>({ kickoff:new Date(Date.now()+3600000).toISOString().slice(0,16), sport:'football', status:'SCHEDULED', role:'wide', fps:'30' }); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const set=(k:string,v:string)=>setForm((f)=>({...f,[k]:v})); const save=async()=>{setBusy(true);setError('');try{if(mode==='team') await teamsApi.create({name:form.name,shortName:form.shortName||undefined,competition:form.competition||undefined,country:form.country||undefined,stadium:form.stadium||undefined}); if(mode==='player') await playersApi.create({name:form.name,teamId:form.teamId||undefined,teamName:teams.find((t)=>t.id===form.teamId)?.name,position:form.position||undefined,nationality:form.nationality||undefined,jerseyNumber:form.jerseyNumber?Number(form.jerseyNumber):undefined}); if(mode==='match') await matchesApi.create({sport:form.sport||'football',homeTeam:form.homeTeam,awayTeam:form.awayTeam,kickoff:new Date(form.kickoff).toISOString(),status:'SCHEDULED',homeScore:0,awayScore:0,competition:form.competition||undefined,venue:form.venue||undefined}); if(mode==='camera') await camerasApi.register({label:form.label,role:form.role||'wide',streamUrl:form.streamUrl,resolution:form.resolution||undefined}); await onSaved();}catch(e){setError((e as Error).message||'Could not save sports record.');}finally{setBusy(false);}}; return <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onMouseDown={onClose}><div onMouseDown={(e)=>e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-950 p-5"><div className="flex"><h2 className="font-black capitalize">Add {mode}</h2><button onClick={onClose} className="ml-auto"><X className="h-5 w-5" /></button></div><div className="mt-4 grid gap-3">{mode==='team'&&<><Input label="Team name" value={form.name} onChange={(v)=>set('name',v)}/><div className="grid grid-cols-2 gap-3"><Input label="Short name" value={form.shortName} onChange={(v)=>set('shortName',v)}/><Input label="Country" value={form.country} onChange={(v)=>set('country',v)}/></div><Input label="Competition" value={form.competition} onChange={(v)=>set('competition',v)}/><Input label="Stadium" value={form.stadium} onChange={(v)=>set('stadium',v)}/></>}{mode==='player'&&<><Input label="Player name" value={form.name} onChange={(v)=>set('name',v)}/><label className="grid gap-1 text-xs text-gray-400">Team<select value={form.teamId||''} onChange={(e)=>set('teamId',e.target.value)} className="field"><option value="">Unassigned</option>{teams.map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><Input label="Position" value={form.position} onChange={(v)=>set('position',v)}/><Input label="Jersey #" type="number" value={form.jerseyNumber} onChange={(v)=>set('jerseyNumber',v)}/></div><Input label="Nationality" value={form.nationality} onChange={(v)=>set('nationality',v)}/></>}{mode==='match'&&<><div className="grid grid-cols-2 gap-3"><Input label="Home team" value={form.homeTeam} onChange={(v)=>set('homeTeam',v)}/><Input label="Away team" value={form.awayTeam} onChange={(v)=>set('awayTeam',v)}/></div><Input label="Kickoff" type="datetime-local" value={form.kickoff} onChange={(v)=>set('kickoff',v)}/><Input label="Competition" value={form.competition} onChange={(v)=>set('competition',v)}/><Input label="Venue" value={form.venue} onChange={(v)=>set('venue',v)}/></>}{mode==='camera'&&<><Input label="Camera label" value={form.label} onChange={(v)=>set('label',v)}/><Input label="Stream URL" value={form.streamUrl} onChange={(v)=>set('streamUrl',v)}/><div className="grid grid-cols-2 gap-3"><Input label="Role" value={form.role} onChange={(v)=>set('role',v)}/><Input label="Resolution" value={form.resolution} onChange={(v)=>set('resolution',v)}/></div></>}{error&&<p className="text-xs text-rose-300">{error}</p>}<button onClick={()=>void save()} disabled={busy} className="h-10 rounded-xl bg-amber-500 text-gray-950 font-black disabled:opacity-50">{busy?'Saving…':'Save'}</button></div></div></div>; }
function Input({label,value,onChange,type='text'}:{label:string;value?:string;onChange:(v:string)=>void;type?:string}){return <label className="grid gap-1 text-xs text-gray-400">{label}<input type={type} value={value||''} onChange={(e)=>onChange(e.target.value)} className="h-10 rounded-xl bg-gray-900 border border-gray-700 px-3 text-sm" /></label>;}
function Panel({children}:{children:React.ReactNode}){return <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">{children}</section>;}
function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4"><span className="text-xs text-gray-500">{label}</span><b className="block text-xl mt-1 truncate">{value}</b></div>;}
function Mini({label,value}:{label:string;value:string|number}){return <div className="rounded-xl bg-gray-950 p-2"><span className="text-[10px] text-gray-500">{label}</span><b className="block text-sm mt-0.5 truncate">{value}</b></div>;}
function Empty({title,body}:{title:string;body:string}){return <div className="py-14 text-center"><CheckCircle2 className="h-9 w-9 mx-auto text-gray-700"/><b className="block mt-3">{title}</b><p className="text-sm text-gray-500 mt-1">{body}</p></div>;}
function Action({label,onClick}:{label:string;onClick:()=>void}){return <button onClick={onClick} className="h-8 px-2.5 rounded-lg border border-gray-700 hover:bg-gray-800 font-bold">{label}</button>;}
function Status({value}:{value:Match['status']}){const cls=value==='LIVE'?'bg-rose-500/15 text-rose-300':value==='FT'?'bg-emerald-500/10 text-emerald-300':'bg-gray-800 text-gray-400';return <span className={`text-[9px] font-black px-2 py-1 rounded-full ${cls}`}>{value}</span>;}
