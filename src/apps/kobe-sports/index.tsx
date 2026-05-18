import { useState } from 'react';
import Dashboard from './components/Dashboard';
import Matches from './components/Matches';
import Teams from './components/Teams';
import Players from './components/Players';
import Analytics from './components/Analytics';
import AiStudio from './components/AiStudio';
import Tracking from './components/Tracking';
import Broadcast from './components/Broadcast';
import type { Match, LiveMatch } from './api';

type Tab = 'dashboard' | 'matches' | 'tracking' | 'analytics' | 'broadcast' | 'teams' | 'players' | 'ai';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'matches',   label: 'Matches',   icon: '⚽' },
  { id: 'tracking',  label: 'Tracking',  icon: '🏃' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'broadcast', label: 'Broadcast', icon: '📺' },
  { id: 'teams',     label: 'Teams',     icon: '🛡️' },
  { id: 'players',   label: 'Players',   icon: '👤' },
  { id: 'ai',        label: 'AI Studio', icon: '🤖' },
];

export default function KobeSports() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedMatch, setSelectedMatch] = useState<Match | LiveMatch | null>(null);

  const handleSelectMatch = (match: Match | LiveMatch) => {
    setSelectedMatch(match);
    setActiveTab('analytics');
  };

  const selectedMatchId = selectedMatch
    ? ('id' in selectedMatch ? selectedMatch.id : selectedMatch.externalId)
    : undefined;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
        <span className="text-xl">🏆</span>
        <div>
          <h1 className="text-base font-bold text-white leading-none">KobeSports Analytics</h1>
          <p className="text-[11px] text-gray-400">AI-powered football intelligence</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedMatch && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-xs">
              <span className="text-gray-400">Watching:</span>
              <span className="text-white font-medium">
                {selectedMatch.homeTeam} vs {selectedMatch.awayTeam}
              </span>
              {selectedMatch.status === 'LIVE' && (
                <span className="flex items-center gap-1 text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-900/50 text-green-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 px-3 pt-2 bg-gray-900 border-b border-gray-800 shrink-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-950 text-white border-t border-x border-gray-700'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard'  && <div className="h-full overflow-auto"><Dashboard /></div>}
        {activeTab === 'matches'    && <Matches onSelectMatch={handleSelectMatch} selectedMatchId={selectedMatchId} />}
        {activeTab === 'tracking'   && <Tracking />}
        {activeTab === 'analytics'  && <div className="h-full overflow-auto"><Analytics /></div>}
        {activeTab === 'broadcast'  && <Broadcast />}
        {activeTab === 'teams'      && <div className="h-full overflow-auto"><Teams /></div>}
        {activeTab === 'players'    && <div className="h-full overflow-auto"><Players /></div>}
        {activeTab === 'ai'         && <div className="h-full overflow-auto"><AiStudio /></div>}
      </div>
    </div>
  );
}
