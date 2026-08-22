import { useCallback, useEffect, useState } from 'react';
import { Activity, Camera, Loader2, Plus, RefreshCw, Search, Shield, Trophy, UserRound, X } from 'lucide-react';
import { analyticsApi, camerasApi, matchesApi, playersApi, teamsApi, type Analytics, type Camera as CameraRow, type Match, type Player, type Team } from './api';

type Tab = 'matches' | 'teams' | 'players' | 'analytics' | 'cameras';
type CreateMode = 'match' | 'team' | 'player' | 'camera';

export default function KobeSports() {
  const [tab, setTab] = useState<Tab>('matches');
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [error, setError] = useState('');
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [matchRows, teamRows, playerRows, cameraRows] = await Promise.all([
        matchesApi.list(1, 100),
        teamsApi.list(1, 100),
        playersApi.list(1, 200),
        camerasApi.list(),
      ]);
      setMatches(Array.isArray(matchRows.data) ? matchRows.data : []);
      setTeams(Array.isArray(teamRows.data) ? teamRows.data : []);
      setPlayers(Array.isArray(playerRows.data) ? playerRows.data : []);
      setCameras(Array.isArray(cameraRows) ? cameraRows : []);
      setSelectedMatchId((current) => current || matchRows.data?.[0]?.id || '');
    } catch (cause) {
      setError((cause as Error).message || 'Kobe Sports could not load live records.');
      setMatches([]); setTeams([]); setPlayers([]); setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async (matchId: string) => {
    if (!matchId) {
      setAnalytics(null);
      return;
    }
    setAnalyticsBusy(true);
    try { setAnalytics(await analyticsApi.forMatch(matchId)); }
    catch { setAnalytics(null); }
    finally { setAnalyticsBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (tab === 'analytics') void loadAnalytics(selectedMatchId); }, [tab, selectedMatchId, loadAnalytics]);

  const query = search.trim().toLowerCase();
  const filteredMatches = matches.filter((row) => !query || `${row.homeTeam} ${row.awayTeam} ${row.competition ?? ''} ${row.venue ?? ''}`.toLowerCase().includes(query));
  const filteredTeams = teams.filter((row) => !query || `${row.name} ${row.shortName ?? ''} ${row.competition ?? ''} ${row.country ?? ''}`.toLowerCase().includes(query));
  const filteredPlayers = players.filter((row) => !query || `${row.name} ${row.teamName ?? ''} ${row.position ?? ''} ${row.nationality ?? ''}`.toLowerCase().includes(query));
  const liveCount = matches.filter((row) => row.status === 'LIVE' || row.status === 'HT').length;

  const matchAction = async (row: Match, action: 'start' | 'halftime' | 'end' | 'postpone') => {
    setError('');
    try {
      if (action === 'start') await matchesApi.start(row.id);
      if (action === 'halftime') await matchesApi.halftime(row.id);
      if (action === 'end') await matchesApi.end(row.id);
      if (action === 'postpone') await matchesApi.postpone(row.id);
      await load();
    } catch (cause) { setError((cause as Error).message || 'Could not update match.'); }
  };

  const updateScore = async (row: Match) => {
    const home = Number(window.prompt(`${row.homeTeam} score`, String(row.homeScore)));
    if (!Number.isFinite(home) || home < 0) return;
    const away = Number(window.prompt(`${row.awayTeam} score`, String(row.awayScore)));
    if (!Number.isFinite(away) || away < 0) return;
    try { await matchesApi.updateScore(row.id, { homeScore: home, awayScore: away }); await load(); }
    catch (cause) { setError((cause as Error).message || 'Could not update score.'); }
  };

  const generateReport = async () => {
    if (!selectedMatchId) return;
    setAnalyticsBusy(true);
    setError('');
    try {
      await analyticsApi.tacticalReport(selectedMatchId);
      await loadAnalytics(selectedMatchId);
    } catch (cause) { setError((cause as Error).message || 'Tactical report is unavailable.'); }
    finally { setAnalyticsBusy(false); }
  };

  const openCreate = () => setCreateMode(tab === 'matches' ? 'match' : tab === 'teams' ? 'team' : tab === 'players' ? 'player' : 'camera');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-950 text-white">
      <header className="shrink-0 border-b border-gray-800 bg-gray-900">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/15 text-amber-300"><Trophy className="h-5 w-5" /></div>
          <div><h1 className="font-black">Kobe Sports</h1><p className="text-[11px] text-gray-500">Fixtures, teams, players, cameras and match analytics</p></div>
          <button onClick={() => void load()} disabled={loading} className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-gray-700 text-gray-400"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <nav className="flex overflow-x-auto px-3">
          {([['matches', 'Matches', Trophy], ['teams', 'Teams', Shield], ['players', 'Players', UserRound], ['analytics', 'Analytics', Activity], ['cameras', 'Cameras', Camera]] as const).map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`inline-flex h-11 items-center gap-2 border-b-2 px-3 text-xs font-black ${tab === id ? 'border-amber-300 text-amber-300' : 'border-transparent text-gray-500'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </nav>
      </header>

      <main className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Matches" value={matches.length} /><Metric label="Live now" value={liveCount} /><Metric label="Teams" value={teams.length} /><Metric label="Players" value={players.length} /></div>
        <div className="flex gap-2"><div className="relative max-w-lg flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search live sports records" className="h-10 w-full rounded-xl border border-gray-800 bg-gray-900 pl-9 pr-3 text-sm" /></div>{tab !== 'analytics' && <button onClick={openCreate} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-500 px-3 text-xs font-black text-gray-950"><Plus className="h-4 w-4" />Add</button>}</div>

        {loading ? <div className="grid place-items-center py-24 text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : tab === 'matches' ? (
          <section className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4">{filteredMatches.map((row) => <div key={row.id} className="flex flex-col gap-3 border-b border-gray-800 py-3 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Status value={row.status} /><b className="truncate">{row.homeTeam} vs {row.awayTeam}</b></div><span className="mt-1 block text-xs text-gray-500">{new Date(row.kickoff).toLocaleString()}{row.competition ? ` · ${row.competition}` : ''}{row.venue ? ` · ${row.venue}` : ''}</span></div><button onClick={() => void updateScore(row)} className="h-10 min-w-24 rounded-xl border border-gray-700 bg-gray-950 font-black">{row.homeScore} – {row.awayScore}</button><div className="flex flex-wrap gap-1.5">{row.status === 'SCHEDULED' && <Action label="Start" onClick={() => void matchAction(row, 'start')} />}{row.status === 'LIVE' && <Action label="Half time" onClick={() => void matchAction(row, 'halftime')} />}{(row.status === 'LIVE' || row.status === 'HT') && <Action label="End" onClick={() => void matchAction(row, 'end')} />}{row.status === 'SCHEDULED' && <Action label="Postpone" onClick={() => void matchAction(row, 'postpone')} />}<Action label="Analytics" onClick={() => { setSelectedMatchId(row.id); setTab('analytics'); }} /></div></div>)}{!filteredMatches.length && <Empty body="No matches found. Create the first real fixture." />}</section>
        ) : tab === 'teams' ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredTeams.map((row) => <div key={row.id} className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-300"><Shield className="h-5 w-5" /></div><b className="mt-3 block">{row.name}</b><span className="text-xs text-gray-500">{row.competition || 'No competition'}{row.country ? ` · ${row.country}` : ''}</span><div className="mt-4 grid grid-cols-4 gap-2"><Mini label="P" value={row.played} /><Mini label="W" value={row.won} /><Mini label="D" value={row.drawn} /><Mini label="Pts" value={row.points} /></div></div>)}{!filteredTeams.length && <div className="md:col-span-2 xl:col-span-3"><Empty body="No teams found." /></div>}</div>
        ) : tab === 'players' ? (
          <section className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4">{filteredPlayers.map((row) => <div key={row.id} className="flex items-center gap-3 border-b border-gray-800 py-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-gray-800 text-xs font-black">{row.jerseyNumber ?? row.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><span className="text-xs text-gray-500">{row.teamName || 'Unassigned'}{row.position ? ` · ${row.position}` : ''}{row.nationality ? ` · ${row.nationality}` : ''}</span></div><b className="text-amber-300">{Number(row.rating || 0).toFixed(1)}</b></div>)}{!filteredPlayers.length && <Empty body="No players found." />}</section>
        ) : tab === 'cameras' ? (
          <section className="rounded-2xl border border-gray-800 bg-gray-900/60 px-4">{cameras.map((row) => <CameraRowView key={row.id} row={row} matches={matches} onChanged={load} />)}{!cameras.length && <Empty body="No cameras registered. Add a real stream before enabling tracking." />}</section>
        ) : <AnalyticsView matches={matches} selectedMatchId={selectedMatchId} setSelectedMatchId={setSelectedMatchId} analytics={analytics} busy={analyticsBusy} refresh={loadAnalytics} report={generateReport} />}
      </main>

      {createMode && <CreateDialog mode={createMode} teams={teams} onClose={() => setCreateMode(null)} onSaved={async () => { setCreateMode(null); await load(); }} />}
    </div>
  );
}

function CameraRowView({ row, matches, onChanged }: { row: CameraRow; matches: Match[]; onChanged: () => Promise<void> }) {
  const assign = async () => {
    const matchId = window.prompt('Match ID to assign', matches.find((match) => match.status === 'LIVE')?.id || matches[0]?.id || '');
    if (!matchId) return;
    await camerasApi.assign(row.id, matchId);
    await onChanged();
  };
  return <div className="flex items-center gap-3 border-b border-gray-800 py-3"><div className={`grid h-10 w-10 place-items-center rounded-xl ${row.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-800 text-gray-500'}`}><Camera className="h-5 w-5" /></div><div className="min-w-0 flex-1"><b className="block truncate">{row.label}</b><span className="text-xs text-gray-500">{row.role} · {row.status} · {row.fps} fps{row.resolution ? ` · ${row.resolution}` : ''}</span></div>{row.activeMatchId ? <Action label="Release" onClick={() => void camerasApi.release(row.id).then(onChanged)} /> : <Action label="Assign" onClick={() => void assign()} />}</div>;
}

function AnalyticsView({ matches, selectedMatchId, setSelectedMatchId, analytics, busy, refresh, report }: { matches: Match[]; selectedMatchId: string; setSelectedMatchId: (id: string) => void; analytics: Analytics | null; busy: boolean; refresh: (id: string) => Promise<void>; report: () => Promise<void> }) {
  const match = matches.find((row) => row.id === selectedMatchId);
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)} className="h-10 min-w-72 rounded-xl border border-gray-800 bg-gray-900 px-3 text-sm"><option value="">Select match</option>{matches.map((row) => <option key={row.id} value={row.id}>{row.homeTeam} vs {row.awayTeam}</option>)}</select><Action label="Refresh" onClick={() => void refresh(selectedMatchId)} disabled={!selectedMatchId || busy} /><Action label="Generate tactical report" onClick={() => void report()} disabled={!selectedMatchId || busy} /></div>{busy ? <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-amber-300" /></div> : !match ? <Empty body="Select a match to inspect persisted analytics." /> : !analytics ? <Empty body="No analytics record exists for this match yet." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Metric label="Status" value={analytics.status} /><Metric label="Possession" value={analytics.possession ? `${analytics.possession.home}% / ${analytics.possession.away}%` : '—'} /><Metric label="Formation" value={analytics.formations ? `${analytics.formations.home} / ${analytics.formations.away}` : '—'} /><Metric label="xG samples" value={String((analytics.xgData?.home?.length || 0) + (analytics.xgData?.away?.length || 0))} />{analytics.aiTacticalReport && <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-gray-800 bg-gray-900/60 p-4"><h3 className="font-black">AI tactical report</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300">{analytics.aiTacticalReport}</p></div>}</div>}</div>;
}

function CreateDialog({ mode, teams, onClose, onSaved }: { mode: CreateMode; teams: Team[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string>>({ sport: 'football', status: 'SCHEDULED', kickoff: new Date().toISOString().slice(0, 16), fps: '25' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setBusy(true); setError('');
    try {
      if (mode === 'match') await matchesApi.create({ sport: form.sport || 'football', homeTeam: form.homeTeam, awayTeam: form.awayTeam, kickoff: new Date(form.kickoff).toISOString(), venue: form.venue || undefined, competition: form.competition || undefined, status: 'SCHEDULED', homeScore: 0, awayScore: 0 });
      if (mode === 'team') await teamsApi.create({ name: form.name, shortName: form.shortName || undefined, competition: form.competition || undefined, country: form.country || undefined, stadium: form.stadium || undefined });
      if (mode === 'player') await playersApi.create({ name: form.name, teamId: form.teamId || undefined, position: form.position || undefined, nationality: form.nationality || undefined, jerseyNumber: form.jerseyNumber ? Number(form.jerseyNumber) : undefined, rating: 0 });
      if (mode === 'camera') await camerasApi.register({ label: form.label, role: form.role || 'broadcast', streamUrl: form.streamUrl, resolution: form.resolution || undefined });
      await onSaved();
    } catch (cause) { setError((cause as Error).message || 'Could not save sports record.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-4"><div className="flex items-center"><h2 className="text-lg font-black capitalize">Add {mode}</h2><button onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-gray-700"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-3">{mode === 'match' && <><Field label="Home team" value={form.homeTeam} onChange={(value) => set('homeTeam', value)} /><Field label="Away team" value={form.awayTeam} onChange={(value) => set('awayTeam', value)} /><Field label="Kickoff" type="datetime-local" value={form.kickoff} onChange={(value) => set('kickoff', value)} /><Field label="Competition" value={form.competition} onChange={(value) => set('competition', value)} /><Field label="Venue" value={form.venue} onChange={(value) => set('venue', value)} /></>}{mode === 'team' && <><Field label="Name" value={form.name} onChange={(value) => set('name', value)} /><Field label="Short name" value={form.shortName} onChange={(value) => set('shortName', value)} /><Field label="Competition" value={form.competition} onChange={(value) => set('competition', value)} /><Field label="Country" value={form.country} onChange={(value) => set('country', value)} /><Field label="Stadium" value={form.stadium} onChange={(value) => set('stadium', value)} /></>}{mode === 'player' && <><Field label="Name" value={form.name} onChange={(value) => set('name', value)} /><Select label="Team" value={form.teamId} onChange={(value) => set('teamId', value)} options={teams.map((team) => [team.id, team.name])} /><Field label="Position" value={form.position} onChange={(value) => set('position', value)} /><Field label="Nationality" value={form.nationality} onChange={(value) => set('nationality', value)} /><Field label="Jersey number" type="number" value={form.jerseyNumber} onChange={(value) => set('jerseyNumber', value)} /></>}{mode === 'camera' && <><Field label="Label" value={form.label} onChange={(value) => set('label', value)} /><Field label="Role" value={form.role} onChange={(value) => set('role', value)} /><Field label="Stream URL" value={form.streamUrl} onChange={(value) => set('streamUrl', value)} /><Field label="Resolution" value={form.resolution} onChange={(value) => set('resolution', value)} /></>}{error && <p className="text-sm text-rose-300">{error}</p>}<button onClick={() => void save()} disabled={busy} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-amber-500 font-black text-gray-950 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save live record'}</button></div></div></div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4"><div className="text-lg font-black">{value}</div><div className="mt-1 text-[11px] text-gray-500">{label}</div></div>; }
function Mini({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-gray-950 p-2 text-center"><b className="block text-sm">{value}</b><span className="text-[9px] text-gray-600">{label}</span></div>; }
function Status({ value }: { value: string }) { const active = value === 'LIVE' || value === 'HT'; return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-gray-700 bg-gray-950 text-gray-400'}`}>{value}</span>; }
function Action({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) { return <button onClick={onClick} disabled={disabled} className="h-8 rounded-lg border border-gray-700 px-2 text-xs font-black text-gray-300 disabled:opacity-40">{label}</button>; }
function Empty({ body }: { body: string }) { return <div className="rounded-2xl border border-dashed border-gray-800 py-14 text-center text-sm text-gray-500">{body}</div>; }
function Field({ label, value, onChange, type = 'text' }: { label: string; value?: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1 text-xs text-gray-400">{label}<input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-gray-700 bg-black/20 px-3 text-sm text-white" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value?: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <label className="grid gap-1 text-xs text-gray-400">{label}<select value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-gray-700 bg-black/20 px-3 text-sm text-white"><option value="">Select</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>; }
