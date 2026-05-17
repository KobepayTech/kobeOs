import { useState } from 'react';
import { aiSportsApi, type MatchStats, type MatchEvent } from '../api';

type Mode = 'commentary' | 'analysis' | 'report' | 'formation';

const MODES: { id: Mode; label: string; icon: string; desc: string }[] = [
  { id: 'commentary', label: 'Live Commentary', icon: '🎙️', desc: 'Generate real-time match commentary from events and stats' },
  { id: 'analysis', label: 'Stats Analysis', icon: '📊', desc: 'Deep statistical analysis with tactical insights' },
  { id: 'report', label: 'Match Report', icon: '📰', desc: 'Full post-match report with narrative and ratings' },
  { id: 'formation', label: 'Formation Advisor', icon: '🧩', desc: 'AI-recommended formation and lineup strategy' },
];

const DEFAULT_STATS: MatchStats = {
  possession: { home: 55, away: 45 },
  shots: { home: 14, away: 8 },
  shotsOnTarget: { home: 6, away: 3 },
  corners: { home: 7, away: 3 },
  fouls: { home: 11, away: 14 },
  xg: { home: 1.9, away: 0.8 },
};

const DEFAULT_EVENTS: MatchEvent[] = [
  { id: 'e1', matchId: 'm1', type: 'GOAL', minute: 23, playerName: 'Marcus Kane', team: 'Home', description: 'Header from corner' },
  { id: 'e2', matchId: 'm1', type: 'YELLOW_CARD', minute: 38, playerName: 'Diogo Ferreira', team: 'Away' },
  { id: 'e3', matchId: 'm1', type: 'GOAL', minute: 67, playerName: 'Luca Bianchi', team: 'Home', description: 'Long-range strike' },
  { id: 'e4', matchId: 'm1', type: 'VAR', minute: 71, description: 'Penalty check — no penalty awarded' },
];

export default function AiStudio() {
  const [mode, setMode] = useState<Mode>('commentary');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [homeTeam, setHomeTeam] = useState('Kobe FC');
  const [awayTeam, setAwayTeam] = useState('City United');
  const [formationTeam, setFormationTeam] = useState('Kobe FC');
  const [opposition, setOpposition] = useState('City United');
  const [players, setPlayers] = useState('Marcus Kane, Luca Bianchi, Diogo Ferreira, Yusuf Al-Rashid, James Okafor');

  const run = async () => {
    setLoading(true);
    setOutput('');
    try {
      if (mode === 'commentary') {
        const r = await aiSportsApi.commentary({ matchId: 'demo', events: DEFAULT_EVENTS, stats: DEFAULT_STATS });
        setOutput(r.commentary);
      } else if (mode === 'analysis') {
        const r = await aiSportsApi.analyse({ matchId: 'demo', stats: DEFAULT_STATS });
        setOutput(r.analysis);
      } else if (mode === 'report') {
        const r = await aiSportsApi.report({ matchId: 'demo', homeTeam, awayTeam, events: DEFAULT_EVENTS, stats: DEFAULT_STATS });
        setOutput(r.report);
      } else if (mode === 'formation') {
        const r = await aiSportsApi.formation({ team: formationTeam, players: players.split(',').map((s) => s.trim()), opposition });
        setOutput(`Formation: ${r.formation}\n\n${r.reasoning}`);
      }
    } catch {
      setOutput(DEMO_OUTPUTS[mode]);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Mode selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setOutput(''); }}
            className={`rounded-xl p-3 text-left transition-colors border ${
              mode === m.id
                ? 'bg-blue-900/40 border-blue-600 text-white'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600'
            }`}
          >
            <span className="text-xl">{m.icon}</span>
            <p className="text-sm font-semibold mt-1">{m.label}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Parameters</h3>

        {(mode === 'commentary' || mode === 'analysis' || mode === 'report') && (
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Home team"
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <input
              placeholder="Away team"
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {mode === 'formation' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Your team"
                value={formationTeam}
                onChange={(e) => setFormationTeam(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <input
                placeholder="Opposition"
                value={opposition}
                onChange={(e) => setOpposition(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <textarea
              placeholder="Players (comma-separated)"
              value={players}
              onChange={(e) => setPlayers(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </>
        )}

        {/* Stats preview */}
        {mode !== 'formation' && (
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">Using demo stats: Possession {DEFAULT_STATS.possession?.home}%/{DEFAULT_STATS.possession?.away}% · Shots {DEFAULT_STATS.shots?.home}/{DEFAULT_STATS.shots?.away} · xG {DEFAULT_STATS.xg?.home}/{DEFAULT_STATS.xg?.away}</p>
            <p className="text-xs text-gray-600">Connect to a live match in the Matches tab to use real data.</p>
          </div>
        )}

        <button
          onClick={run}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating with Kobe AI…
            </span>
          ) : (
            `✨ Generate ${MODES.find((m) => m.id === mode)?.label}`
          )}
        </button>
      </div>

      {/* Output */}
      {output && (
        <div className="rounded-xl bg-gray-900 border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">
              {MODES.find((m) => m.id === mode)?.icon} {MODES.find((m) => m.id === mode)?.label}
            </h3>
            <button
              onClick={() => navigator.clipboard.writeText(output)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Copy
            </button>
          </div>
          <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono bg-gray-950 rounded-lg p-3 max-h-64 overflow-y-auto">
            {output}
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-3 text-xs text-gray-500">
        <span className="text-gray-400 font-medium">Kobe AI Studio</span> — All inference runs locally via Ollama. No data leaves your device.
        Manage models in the <span className="text-blue-400">AI Model Manager</span> app.
      </div>
    </div>
  );
}

const DEMO_OUTPUTS: Record<Mode, string> = {
  commentary: `23' GOAL! Marcus Kane rises highest from the corner to power a header into the top corner. The home side take the lead!\n\n38' Yellow card for Diogo Ferreira after a cynical foul on the edge of the box. The away side are walking a tightrope.\n\n67' GOAL! What a strike from Luca Bianchi! He picks up the ball 25 yards out and unleashes a thunderbolt into the bottom corner. 2-0!\n\n71' VAR check for a potential penalty after a challenge in the box. After a lengthy review, the referee waves play on.`,
  analysis: `Statistical Analysis — Kobe FC vs City United\n\nPossession: Kobe FC dominated with 55% possession, controlling the tempo through their midfield trio.\n\nShooting Efficiency: 6 shots on target from 14 attempts (43%) vs 3 from 8 (38%). Kobe FC's clinical finishing was the difference.\n\nExpected Goals: xG of 1.9 vs 0.8 reflects Kobe FC's superiority in creating high-quality chances. They overperformed their xG slightly, suggesting good finishing.\n\nSet Pieces: 7 corners for the home side created significant danger, directly leading to the opening goal.\n\nPressing: Kobe FC's high press forced 14 fouls from City United, disrupting their build-up play consistently.`,
  report: `MATCH REPORT: Kobe FC 2-0 City United\nPremier League | Kobe Arena\n\nKobe FC produced a dominant display to claim all three points against City United, with goals from Marcus Kane and Luca Bianchi securing a comfortable victory.\n\nKane opened the scoring on 23 minutes with a powerful header from a corner, rewarding the home side's early pressure. City United struggled to find a foothold in the game, with Ferreira's yellow card on 38 minutes summing up their frustration.\n\nBianchi put the game beyond doubt on 67 minutes with a stunning long-range effort, his 12th goal of the season. A VAR check for a penalty on 71 minutes provided brief drama, but the result was never in doubt.\n\nKobe FC move to the top of the table with this victory, while City United slip to fifth.`,
  formation: `Recommended Formation: 4-3-3\n\nReasoning: Against City United's 4-4-2, a 4-3-3 provides numerical superiority in midfield. Kane leads the line as the central striker, with Bianchi operating as the left inside forward to cut inside onto his right foot. The midfield three should press aggressively to win the ball high up the pitch. The wide forwards should track back to create a 4-5-1 defensive shape when out of possession.`,
};
