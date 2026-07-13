import { useCallback, useEffect, useMemo, useState } from 'react';
import { teamsApi, playersApi, matchesApi, type Team, type Player, type Match, type LineupPlayer } from '@/apps/kobe-sports/api';
import { usePwaManifest } from '@/hooks/usePwaManifest';
import { InstallPwaButton } from '@/mobile/InstallPwaButton';
import {
  Shield, Users, ClipboardList, Plus, Trash2, Loader2, ChevronLeft, Save, CheckCircle2, Pencil, X, Goal,
} from 'lucide-react';

/**
 * Kobe Coach — a phone-first, installable PWA for coaches and team admins to
 * manage teams, squads, and match lineups. Reuses the KobeSports backend
 * (teams/players/lineups CRUD). Standalone at /coach.
 */
type Tab = 'teams' | 'squad' | 'lineup';

/** The /sports list endpoints return a raw array; the shared client types
 *  them as {data,total}. Normalise to an array either way. */
function asList<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  const d = (r as { data?: T[] } | null)?.data;
  return Array.isArray(d) ? d : [];
}

export default function KobeCoach() {
  const [tab, setTab] = useState<Tab>('teams');
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const standalone = typeof window !== 'undefined' && /^\/coach(\/|$)/.test(window.location.pathname);
  usePwaManifest({ name: 'Kobe Coach', shortName: 'Coach', startUrl: '/coach', iconBase: '/coach', themeColor: '#0d9488', enabled: standalone });

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-teal-700 text-white shrink-0">
        <div className="flex items-center gap-2"><Goal className="w-5 h-5" /><span className="font-extrabold">Kobe Coach</span></div>
        {standalone && <InstallPwaButton />}
      </div>
      <div className="flex border-b border-slate-200 bg-white shrink-0">
        {([['teams', 'Teams', Shield], ['squad', 'Squad', Users], ['lineup', 'Lineup', ClipboardList]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-bold ${tab === k ? 'text-teal-700 border-b-2 border-teal-600' : 'text-slate-500'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'teams' && <TeamsTab onManageSquad={(t) => { setActiveTeam(t); setTab('squad'); }} />}
        {tab === 'squad' && <SquadTab team={activeTeam} onPickTeam={() => setTab('teams')} />}
        {tab === 'lineup' && <LineupTab />}
      </div>
    </div>
  );
}

/* ── Teams ── */
function TeamsTab({ onManageSquad }: { onManageSquad: (t: Team) => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Team> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await teamsApi.list(1, 100); setTeams(asList<Team>(r)); } catch { setTeams([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit?.name?.trim()) return;
    if (edit.id) await teamsApi.update(edit.id, edit); else await teamsApi.create(edit);
    setEdit(null); load();
  };
  const remove = async (id: string) => { if (confirm('Delete this team?')) { await teamsApi.delete(id); load(); } };

  if (loading) return <Center />;
  return (
    <div className="p-4 space-y-2">
      <button onClick={() => setEdit({ name: '' })} className="w-full h-11 rounded-xl bg-teal-600 text-white font-bold inline-flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add team</button>
      {teams.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No teams yet.</p>}
      {teams.map((t) => (
        <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-between">
          <button onClick={() => onManageSquad(t)} className="text-left min-w-0">
            <div className="font-bold truncate">{t.name}</div>
            <div className="text-[11px] text-slate-400">{[t.competition, t.country].filter(Boolean).join(' · ') || 'Tap to manage squad'}</div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEdit(t)} className="p-2 text-slate-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => remove(t.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      {edit && (
        <Sheet title={edit.id ? 'Edit team' : 'Add team'} onClose={() => setEdit(null)} onSave={save}>
          <In v={edit.name ?? ''} set={(v) => setEdit({ ...edit, name: v })} ph="Team name *" />
          <div className="grid grid-cols-2 gap-2">
            <In v={edit.shortName ?? ''} set={(v) => setEdit({ ...edit, shortName: v })} ph="Short name" />
            <In v={edit.competition ?? ''} set={(v) => setEdit({ ...edit, competition: v })} ph="Competition" />
            <In v={edit.country ?? ''} set={(v) => setEdit({ ...edit, country: v })} ph="Country" />
            <In v={edit.stadium ?? ''} set={(v) => setEdit({ ...edit, stadium: v })} ph="Stadium" />
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ── Squad (players of a team) ── */
function SquadTab({ team, onPickTeam }: { team: Team | null; onPickTeam: () => void }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Partial<Player> | null>(null);

  const load = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    try { const r = await playersApi.list(1, 200); setPlayers(asList<Player>(r).filter((p) => p.teamId === team.id)); }
    catch { setPlayers([]); } finally { setLoading(false); }
  }, [team]);
  useEffect(() => { load(); }, [load]);

  if (!team) return <div className="p-8 text-center text-slate-500 text-sm">Pick a team on the <button onClick={onPickTeam} className="text-teal-600 font-semibold">Teams</button> tab to manage its squad.</div>;

  const save = async () => {
    if (!edit?.name?.trim()) return;
    const body = { ...edit, teamId: team.id, teamName: team.name, jerseyNumber: edit.jerseyNumber ? Number(edit.jerseyNumber) : undefined };
    if (edit.id) await playersApi.update(edit.id, body); else await playersApi.create(body);
    setEdit(null); load();
  };
  const remove = async (id: string) => { if (confirm('Remove this player?')) { await playersApi.delete(id); load(); } };

  return (
    <div className="p-4 space-y-2">
      <button onClick={onPickTeam} className="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold"><ChevronLeft className="w-4 h-4" /> Teams</button>
      <div className="font-extrabold text-lg">{team.name} <span className="text-slate-400 text-sm font-normal">· squad</span></div>
      <button onClick={() => setEdit({ name: '' })} className="w-full h-11 rounded-xl bg-teal-600 text-white font-bold inline-flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add player</button>
      {loading ? <Center /> : players.length === 0 ? <p className="text-center text-slate-400 text-sm py-6">No players yet.</p> : players.map((p) => (
        <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 grid place-items-center font-extrabold shrink-0">{p.jerseyNumber ?? '–'}</div>
            <div className="min-w-0"><div className="font-bold truncate">{p.name}</div><div className="text-[11px] text-slate-400">{[p.position, p.nationality].filter(Boolean).join(' · ') || '—'}</div></div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEdit(p)} className="p-2 text-slate-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => remove(p.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      {edit && (
        <Sheet title={edit.id ? 'Edit player' : 'Add player'} onClose={() => setEdit(null)} onSave={save}>
          <In v={edit.name ?? ''} set={(v) => setEdit({ ...edit, name: v })} ph="Player name *" />
          <div className="grid grid-cols-3 gap-2">
            <In v={edit.jerseyNumber ?? ''} set={(v) => setEdit({ ...edit, jerseyNumber: Number(v) || undefined })} ph="No." type="number" />
            <In v={edit.position ?? ''} set={(v) => setEdit({ ...edit, position: v })} ph="Position" />
            <In v={edit.nationality ?? ''} set={(v) => setEdit({ ...edit, nationality: v })} ph="Nation" />
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ── Lineup builder ── */
function LineupTab() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState('');
  const [side, setSide] = useState<'home' | 'away'>('home');
  const [players, setPlayers] = useState<Player[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([matchesApi.list(1, 50).then((r) => asList<Match>(r)).catch(() => []), playersApi.list(1, 500).then((r) => asList<Player>(r)).catch(() => [])])
      .then(([m, p]) => { setMatches(m); setPlayers(p); }).finally(() => setLoading(false));
  }, []);

  const match = useMemo(() => matches.find((m) => m.id === matchId), [matches, matchId]);
  const teamName = side === 'home' ? match?.homeTeam : match?.awayTeam;
  const squad = useMemo(() => players.filter((p) => p.teamName && teamName && p.teamName.toLowerCase() === teamName.toLowerCase()), [players, teamName]);

  const save = async () => {
    if (!match) return;
    const lineup: LineupPlayer[] = squad.filter((p) => picked[p.id]).map((p) => ({ playerId: p.id, jerseyNumber: p.jerseyNumber ?? 0, name: p.name, position: p.position ?? '', starting: true }));
    const existing = await matchesApi.getLineup(match.id).catch(() => ({ home: [], away: [] }));
    await matchesApi.setLineup(match.id, { ...existing, [side]: lineup } as never);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <Center />;
  return (
    <div className="p-4 space-y-3">
      <select value={matchId} onChange={(e) => { setMatchId(e.target.value); setPicked({}); }} className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white">
        <option value="">Pick a match…</option>
        {matches.map((m) => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>)}
      </select>
      {match && (
        <>
          <div className="flex gap-2">
            {(['home', 'away'] as const).map((s) => (
              <button key={s} onClick={() => { setSide(s); setPicked({}); }} className={`flex-1 h-10 rounded-xl text-sm font-bold ${side === s ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                {s === 'home' ? match.homeTeam : match.awayTeam}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500">{squad.length === 0 ? `No players found for ${teamName}. Add them in Squad (their team name must match).` : `Tap to pick the starting players (${Object.values(picked).filter(Boolean).length} selected).`}</div>
          <div className="space-y-1.5">
            {squad.map((p) => (
              <button key={p.id} onClick={() => setPicked({ ...picked, [p.id]: !picked[p.id] })} className={`w-full flex items-center justify-between rounded-xl border p-3 ${picked[p.id] ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white'}`}>
                <span className="flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-slate-100 grid place-items-center text-xs font-bold">{p.jerseyNumber ?? '–'}</span><span className="font-semibold text-sm">{p.name}</span><span className="text-[11px] text-slate-400">{p.position}</span></span>
                {picked[p.id] && <CheckCircle2 className="w-5 h-5 text-teal-600" />}
              </button>
            ))}
          </div>
          {squad.length > 0 && (
            <button onClick={save} className="w-full h-12 rounded-xl bg-teal-600 text-white font-extrabold inline-flex items-center justify-center gap-2">
              {saved ? <><CheckCircle2 className="w-5 h-5" /> Saved</> : <><Save className="w-5 h-5" /> Save {side} lineup</>}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ── bits ── */
function Center() { return <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>; }
function In({ v, set, ph, type = 'text' }: { v: string | number; set: (v: string) => void; ph: string; type?: string }) {
  return <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} type={type} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" />;
}
function Sheet({ title, children, onClose, onSave }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><span className="font-bold">{title}</span><button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button></div>
        {children}
        <button onClick={onSave} className="w-full h-11 rounded-xl bg-teal-600 text-white font-bold">Save</button>
      </div>
    </div>
  );
}
