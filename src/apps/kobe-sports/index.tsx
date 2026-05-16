import { useState } from 'react';
import Dashboard from './components/Dashboard';
import Matches from './components/Matches';
import Teams from './components/Teams';
import Players from './components/Players';
import Analytics from './components/Analytics';
import AiStudio from './components/AiStudio';

type Tab = 'dashboard' | 'matches' | 'teams' | 'players' | 'analytics' | 'ai';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'matches', label: 'Matches', icon: '⚽' },
  { id: 'teams', label: 'Teams', icon: '🛡️' },
  { id: 'players', label: 'Players', icon: '👤' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'ai', label: 'AI Studio', icon: '🤖' },
];

export default function KobeSports() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <span className="text-2xl">🏆</span>
        <div>
          <h1 className="text-lg font-bold text-white leading-none">KobeSports</h1>
          <p className="text-xs text-gray-400">Sports Analytics Platform</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-900/50 text-green-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-2 bg-gray-900 border-b border-gray-800 shrink-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md whitespace-nowrap transition-colors ${
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
      <div className="flex-1 overflow-auto">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'matches' && <Matches />}
        {activeTab === 'teams' && <Teams />}
        {activeTab === 'players' && <Players />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'ai' && <AiStudio />}
      </div>
    </div>
  );
}
