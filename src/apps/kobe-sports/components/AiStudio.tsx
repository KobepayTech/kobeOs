import { useEffect, useRef, useState } from 'react';
import { matchesApi, analyticsApi, type Match, type Analytics, type HighlightMarker } from '../api';
import { useSportsSocket } from '../useSportsSocket';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommentaryEntry {
  id: string;
  minute: number;
  type: string;
  text: string;
  ts: number;
}


// ── Commentary Feed ───────────────────────────────────────────────────────────

function CommentaryFeed({ entries, loading }: { entries: CommentaryEntry[]; loading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const typeColor: Record<string, string> = {
    GOAL: 'text-green-400',
    PENALTY: 'text-orange-400',
    RED_CARD: 'text-red-400',
    VAR: 'text-yellow-400',
    OWN_GOAL: 'text-purple-400',
    TACTICAL: 'text-blue-400',
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <span className="text-3xl mb-2">🤖</span>
        <p className="text-sm text-gray-400">No commentary yet.</p>
        <p className="text-xs text-gray-500 mt-1">Commentary auto-generates on goals, cards, and every 15 match minutes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {entries.map((e) => (
        <div key={e.id} className="flex gap-3 bg-gray-800 rounded-lg px-3 py-2.5">
          <div className="flex-shrink-0 text-right w-8">
            <span className="text-xs font-bold text-gray-400">{e.minute}'</span>
          </div>
          <div className="flex-1 min-w-0">
            {e.type !== 'TACTICAL' && (
              <span className={`text-[10px] font-bold uppercase mr-1.5 ${typeColor[e.type] ?? 'text-gray-400'}`}>
                {e.type.replace('_', ' ')}
              </span>
            )}
            <span className="text-xs text-gray-200 leading-relaxed">{e.text}</span>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Tactical Report ───────────────────────────────────────────────────────────

function TacticalReport({ report, generating, onGenerate }: {
  report: string; generating: boolean; onGenerate: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Tactical Report</p>
        <button onClick={onGenerate} disabled={generating}
          className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-xs text-white font-medium disabled:opacity-50 flex items-center gap-1.5">
          {generating ? (
            <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
          ) : (
            <>🤖 Generate Report</>
          )}
        </button>
      </div>
      {report ? (
        <div className="bg-gray-800 rounded-xl p-4 text-xs text-gray-200 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
          {report}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500">No report yet. Click Generate to create an AI tactical analysis.</p>
        </div>
      )}
    </div>
  );
}

// ── Highlight Markers ─────────────────────────────────────────────────────────

function HighlightMarkers({ markers, loading }: { markers: HighlightMarker[]; loading: boolean }) {
  const typeIcon: Record<string, string> = {
    GOAL: '⚽',
    PENALTY: '🎯',
    RED_CARD: '🟥',
    VAR: '📺',
    OWN_GOAL: '😬',
    OFFSIDE: '🚩',
  };

  if (loading) return <div className="h-24 rounded-xl bg-gray-800 animate-pulse" />;

  if (markers.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-500">No highlight markers yet. They appear as significant events occur.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {markers.map((m, i) => (
        <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2 text-xs">
          <span className="text-base flex-shrink-0">{typeIcon[m.type] ?? '📌'}</span>
          <span className="text-gray-400 w-8 flex-shrink-0">{m.minute}'</span>
          <span className="text-gray-200 flex-1 truncate">{m.description}</span>
          {m.team && (
            <span className="text-gray-500 flex-shrink-0">{m.team}</span>
          )}
          {m.frameNumber > 0 && (
            <span className="text-gray-600 flex-shrink-0 font-mono">f{m.frameNumber}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Match Selector ────────────────────────────────────────────────────────────

function MatchSelector({ matches, selectedId, onSelect }: {
  matches: Match[]; selectedId: string; onSelect: (id: string) => void;
}) {
  return (
    <select value={selectedId} onChange={(e) => onSelect(e.target.value)}
      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500">
      <option value="">Select a match…</option>
      {matches.map((m) => (
        <option key={m.id} value={m.id}>
          {m.homeTeam} vs {m.awayTeam} — {m.status}{m.status === 'LIVE' ? ' 🔴' : ''}
        </option>
      ))}
    </select>
  );
}

// ── Main AiStudio ─────────────────────────────────────────────────────────────

export default function AiStudio() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([]);
  const [highlights, setHighlights] = useState<HighlightMarker[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingHighlights, setLoadingHighlights] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // WebSocket for live commentary
  const { latestCommentary, latestReport } = useSportsSocket(selectedId || null);

  // Load matches
  useEffect(() => {
    matchesApi.list(1, 50)
      .then((r) => {
        setMatches(r.data);
        // Auto-select first live match
        const live = r.data.find((m) => m.status === 'LIVE');
        if (live) setSelectedId(live.id);
      })
      .catch(() => setMatches(DEMO_MATCHES));
  }, []);

  // Load analytics when match changes
  useEffect(() => {
    if (!selectedId) { setAnalytics(null); setCommentary([]); setHighlights([]); return; }
    setLoadingAnalytics(true);
    setLoadingHighlights(true);

    analyticsApi.forMatch(selectedId)
      .then((a) => {
        setAnalytics(a);
        // Parse stored commentary into entries
        if (a.aiCommentary) {
          const lines = a.aiCommentary.split('\n').filter(Boolean);
          setCommentary(lines.map((line, i) => {
            const minuteMatch = line.match(/^(\d+)'/);
            const minute = minuteMatch ? parseInt(minuteMatch[1]) : 0;
            const text = line.replace(/^\d+' — /, '');
            return { id: `stored-${i}`, minute, type: 'TACTICAL', text, ts: i };
          }));
        }
      })
      .catch(() => null)
      .finally(() => setLoadingAnalytics(false));

    analyticsApi.highlights(selectedId)
      .then(setHighlights)
      .catch(() => setHighlights([]))
      .finally(() => setLoadingHighlights(false));
  }, [selectedId]);

  // Live WebSocket commentary
  useEffect(() => {
    if (!latestCommentary) return;
    setCommentary((prev) => [
      ...prev,
      { id: `live-${Date.now()}`, minute: latestCommentary.minute, type: latestCommentary.type, text: latestCommentary.text, ts: Date.now() },
    ]);
  }, [latestCommentary]);

  useEffect(() => {
    if (!latestReport) return;
    setAnalytics((prev) => prev ? { ...prev, aiTacticalReport: latestReport.report } : prev);
  }, [latestReport]);

  const handleGenerateReport = async () => {
    if (!selectedId) return;
    setGeneratingReport(true);
    try {
      const result = await analyticsApi.tacticalReport(selectedId);
      setAnalytics((prev) => prev ? { ...prev, aiTacticalReport: (result as { report: string }).report } : prev);
    } catch {
      // report will arrive via WebSocket if AI is running
    } finally {
      setGeneratingReport(false);
    }
  };

  const selectedMatch = matches.find((m) => m.id === selectedId);

  return (
    <div className="p-4 space-y-4">
      {/* Match selector */}
      <div className="space-y-1">
        <p className="text-xs text-gray-400">Select match</p>
        <MatchSelector matches={matches} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {!selectedId ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
          <span className="text-4xl">🤖</span>
          <p className="text-sm text-gray-400 mt-3">Select a match to view AI commentary and tactical analysis.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Match header */}
          {selectedMatch && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white">
                  {selectedMatch.homeTeam} {selectedMatch.homeScore}–{selectedMatch.awayScore} {selectedMatch.awayTeam}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedMatch.status === 'LIVE' && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    LIVE
                  </span>
                )}
                <span className="text-xs text-gray-500">{selectedMatch.competition}</span>
              </div>
            </div>
          )}

          {/* Commentary feed */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Live Commentary</p>
              {selectedMatch?.status === 'LIVE' && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Auto-updating
                </span>
              )}
            </div>
            <CommentaryFeed entries={commentary} loading={loadingAnalytics} />
          </div>

          {/* Tactical report */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <TacticalReport
              report={analytics?.aiTacticalReport ?? ''}
              generating={generatingReport}
              onGenerate={handleGenerateReport}
            />
          </div>

          {/* Highlight markers */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Highlight Markers</p>
              <p className="text-xs text-gray-500">For video clip cutting</p>
            </div>
            <HighlightMarkers markers={highlights} loading={loadingHighlights} />
            {highlights.length > 0 && (
              <div className="pt-1 border-t border-gray-800">
                <p className="text-[10px] text-gray-500">
                  Frame numbers can be used by the Python pipeline to cut highlight clips automatically.
                </p>
              </div>
            )}
          </div>

          {/* xG summary if available */}
          {analytics?.xgData && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">xG Summary</p>
              {selectedMatch && (
                <div className="space-y-2">
                  {(['home', 'away'] as const).map((side) => {
                    const xgArr = (analytics.xgData as Record<string, number[]>)[side] ?? [];
                    const total = xgArr.reduce((s: number, v: number) => s + v, 0);
                    const teamName = side === 'home' ? selectedMatch.homeTeam : selectedMatch.awayTeam;
                    return (
                      <div key={side}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400 truncate">{teamName}</span>
                          <span className="text-xs font-bold text-white">{total.toFixed(2)} xG</span>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${side === 'home' ? 'bg-blue-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, total * 20)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DEMO_MATCHES: Match[] = [
  { id: '1', sport: 'football', homeTeam: 'Kobe FC', awayTeam: 'City United', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 1, competition: 'Premier League' },
  { id: '2', sport: 'football', homeTeam: 'Athletic Club', awayTeam: 'Rovers FC', kickoff: new Date().toISOString(), status: 'FT', homeScore: 1, awayScore: 1, competition: 'Championship' },
];
