import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Matches from './components/Matches';
import Teams from './components/Teams';
import Players from './components/Players';
import Analytics from './components/Analytics';
import AiStudio from './components/AiStudio';
import Tracking from './components/Tracking';
import Broadcast from './components/Broadcast';
import Boxing from './components/Boxing';
import { registryApi, type Match, type LiveMatch, type SportDescriptor } from './api';

/**
 * KobeSports — multi-sport hub. The primary nav is driven by the sport
 * REGISTRY (server/src/sports/sports-registry.ts): live sports become
 * sections, roadmap sports show as "soon" chips. Shared sections
 * (Dashboard, Analytics, Broadcast, AI) work across every sport; each sport
 * renders its own modules. Adding a sport = register a descriptor + drop in
 * its module; the nav updates itself.
 */
type Section = 'dashboard' | 'football' | 'boxing' | 'analytics' | 'broadcast' | 'ai';
type FootballTab = 'matches' | 'teams' | 'players' | 'tracking';

const SHARED_AFTER: { id: Section; label: string; icon: string }[] = [
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'broadcast', label: 'Broadcast', icon: '📺' },
  { id: 'ai', label: 'AI Studio', icon: '🤖' },
];
const FOOTBALL_TABS: { id: FootballTab; label: string; icon: string }[] = [
  { id: 'matches', label: 'Fixtures', icon: '📅' },
  { id: 'teams', label: 'Teams', icon: '🛡️' },
  { id: 'players', label: 'Players', icon: '👤' },
  { id: 'tracking', label: 'Tracking', icon: '🏃' },
];

export default function KobeSports() {
  const [section, setSection] = useState<Section>('dashboard');
  const [footballTab, setFootballTab] = useState<FootballTab>('matches');
  const [selectedMatch, setSelectedMatch] = useState<Match | LiveMatch | null>(null);
  const [sports, setSports] = useState<SportDescriptor[]>([]);

  useEffect(() => { registryApi.get().then((r) => setSports(r.sports)).catch(() => setSports([])); }, []);

  const liveSports = sports.filter((s) => s.live);
  const roadmap = sports.filter((s) => !s.live);

  const handleSelectMatch = (match: Match | LiveMatch) => { setSelectedMatch(match); setSection('analytics'); };
  const selectedMatchId = selectedMatch ? ('id' in selectedMatch ? selectedMatch.id : selectedMatch.externalId) : undefined;

  // Primary rail: Dashboard, then live sports (from registry), then shared.
  const primary: { id: Section; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    ...liveSports.filter((s) => s.id === 'football' || s.id === 'boxing').map((s) => ({ id: s.id as Section, label: s.name, icon: s.icon })),
    ...SHARED_AFTER,
  ];

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
        <span className="text-xl">🏆</span>
        <div>
          <h1 className="text-base font-bold text-white leading-none">KobeSports</h1>
          <p className="text-[11px] text-gray-400">Multi-sport platform{sports.length ? ` · ${liveSports.length} live` : ''}</p>
        </div>
        {selectedMatch && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-xs">
            <span className="text-gray-400">Watching:</span>
            <span className="text-white font-medium">{selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</span>
          </div>
        )}
      </div>

      {/* Primary sport rail (registry-driven) */}
      <div className="flex gap-0.5 px-3 pt-2 bg-gray-900 border-b border-gray-800 shrink-0 overflow-x-auto items-center">
        {primary.map((t) => (
          <button key={t.id} onClick={() => setSection(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md whitespace-nowrap transition-colors ${section === t.id ? 'bg-gray-950 text-white border-t border-x border-gray-700' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
        {/* Roadmap sports from the registry — visible plug-in points */}
        {roadmap.length > 0 && (
          <div className="ml-auto flex items-center gap-1 pr-1 shrink-0">
            <span className="text-[10px] text-gray-600 uppercase tracking-wide">Soon</span>
            {roadmap.map((s) => (
              <span key={s.id} title={`${s.name} — coming soon`} className="text-sm opacity-40 grayscale">{s.icon}</span>
            ))}
          </div>
        )}
      </div>

      {/* Football sub-tabs (its modules) */}
      {section === 'football' && (
        <div className="flex gap-0.5 px-3 pt-1.5 pb-1 bg-gray-950 border-b border-gray-800 shrink-0 overflow-x-auto">
          {FOOTBALL_TABS.map((t) => (
            <button key={t.id} onClick={() => setFootballTab(t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap ${footballTab === t.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {section === 'dashboard' && <div className="h-full overflow-auto"><Dashboard /></div>}

        {section === 'football' && footballTab === 'matches' && <Matches onSelectMatch={handleSelectMatch} selectedMatchId={selectedMatchId} />}
        {section === 'football' && footballTab === 'teams' && <div className="h-full overflow-auto"><Teams /></div>}
        {section === 'football' && footballTab === 'players' && <div className="h-full overflow-auto"><Players /></div>}
        {section === 'football' && footballTab === 'tracking' && <Tracking matchId={selectedMatchId} />}

        {section === 'boxing' && <Boxing />}

        {section === 'analytics' && <div className="h-full overflow-auto"><Analytics matchId={selectedMatchId} /></div>}
        {section === 'broadcast' && <Broadcast matchId={selectedMatchId} />}
        {section === 'ai' && <div className="h-full overflow-auto"><AiStudio /></div>}
      </div>
    </div>
  );
}
