import { useState, useCallback, useEffect } from 'react';
import {
  Regex,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

const commonPatterns = [
  { name: 'Email', pattern: '^[\\w.-]+@[\\w.-]+\\.\\w{2,}$', flags: '' },
  { name: 'URL', pattern: 'https?://(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)', flags: 'i' },
  { name: 'Phone', pattern: '\\+?\\d{1,3}[-.\\s]?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}', flags: '' },
  { name: 'IP Address', pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b', flags: '' },
  { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])', flags: '' },
  { name: 'Hex Color', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'i' },
  { name: 'Credit Card', pattern: '\\b(?:4\\d{3}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}|5[1-5]\\d{2}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}|3[47]\\d{2}[\\s-]?\\d{6}[\\s-]?\\d{5}|6011[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4})\\b', flags: '' },
];

export default function RegexTester() {
  const [pattern, setPattern] = useState('[A-Z]+');
  const [flags, setFlags] = useState({ g: false, i: false, m: false, s: false, u: false });
  const [testString, setTestString] = useState('Hello World!\nThis is a TEST string.\n123 ABC xyz.');
  const [replaceString, setReplaceString] = useState('[$&]');
  const [mode, setMode] = useState<'match' | 'replace'>('match');
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<RegExpMatchArray[]>([]);
  const [replaceResult, setReplaceResult] = useState('');
  const [copied, setCopied] = useState(false);

  const runRegex = useCallback(() => {
    setError(null);
    setMatches([]);
    setReplaceResult('');

    const flagStr = Object.entries(flags)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join('');

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flagStr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid regex');
      return;
    }

    if (mode === 'match') {
      const allMatches: RegExpMatchArray[] = [];
      if (flags.g) {
        let m: RegExpExecArray | null;
        const localRegex = new RegExp(pattern, flagStr);
        while ((m = localRegex.exec(testString)) !== null) {
          allMatches.push(m);
          if (m.index === localRegex.lastIndex) localRegex.lastIndex++;
        }
      } else {
        const m = regex.exec(testString);
        if (m) allMatches.push(m);
      }
      setMatches(allMatches);
    } else {
      const result = testString.replace(regex, replaceString);
      setReplaceResult(result);
    }
  }, [pattern, flags, testString, mode, replaceString]);

  useEffect(() => {
    runRegex();
  }, [runRegex]);

  const loadPattern = (p: string, f: string) => {
    setPattern(p);
    setFlags({
      g: f.includes('g'),
      i: f.includes('i'),
      m: f.includes('m'),
      s: f.includes('s'),
      u: f.includes('u'),
    });
  };

  const highlightedText = () => {
    if (mode !== 'match' || matches.length === 0) return testString;
    const parts: { text: string; match: boolean; group?: number }[] = [];
    let lastIndex = 0;

    const sorted = [...matches].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    for (const m of sorted) {
      const idx = m.index ?? 0;
      if (idx > lastIndex) {
        parts.push({ text: testString.slice(lastIndex, idx), match: false });
      }
      parts.push({ text: m[0], match: true });
      lastIndex = idx + m[0].length;
    }
    if (lastIndex < testString.length) {
      parts.push({ text: testString.slice(lastIndex), match: false });
    }

    return parts.map((p, i) =>
      p.match ? (
        <mark key={i} className="bg-yellow-500/40 text-yellow-100 rounded px-0.5">{p.text}</mark>
      ) : (
        <span key={i}>{p.text}</span>
      )
    );
  };

  const copyPattern = () => {
    const flagStr = Object.entries(flags)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join('');
    navigator.clipboard.writeText(`/${pattern}/${flagStr}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-os-text-primary">
      {/* Toolbar */}
      <div className="h-10 flex items-center gap-1 px-2 border-b border-white/[0.08] flex-shrink-0">
        <Regex className="w-4 h-4 text-os-text-muted mr-1" />
        <span className="text-xs text-os-text-muted mr-2">Pattern:</span>
        <span className="text-sm font-mono text-os-accent">/</span>
        <input
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono outline-none focus:border-os-accent flex-1 min-w-0"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="Enter regex pattern..."
        />
        <span className="text-sm font-mono text-os-accent">/</span>
        <div className="flex gap-1 ml-1">
          {(['g', 'i', 'm', 's', 'u'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFlags({ ...flags, [f]: !flags[f] })}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${flags[f] ? 'bg-os-accent/20 text-os-accent border border-os-accent/30' : 'text-os-text-muted border border-white/10 hover:bg-white/5'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={copyPattern} className="ml-2 p-1 rounded hover:bg-white/10">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Test string + Common patterns */}
        <div className="flex-1 flex flex-col border-r border-white/[0.08] min-w-0">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.08]">
            <button
              onClick={() => setMode('match')}
              className={`px-2 py-0.5 rounded text-xs ${mode === 'match' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'}`}
            >
              Match
            </button>
            <button
              onClick={() => setMode('replace')}
              className={`px-2 py-0.5 rounded text-xs ${mode === 'replace' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'}`}
            >
              Replace
            </button>
            <div className="flex-1" />
            <span className="text-xs text-os-text-muted">
              {mode === 'match' ? `${matches.length} match${matches.length !== 1 ? 'es' : ''}` : 'Replace mode'}
            </span>
          </div>

          {/* Test string */}
          <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase">Test String</div>
          <textarea
            className="flex-1 bg-transparent p-2 font-mono text-xs resize-none outline-none text-os-text-primary"
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            spellCheck={false}
          />

          {/* Replace input */}
          {mode === 'replace' && (
            <div className="border-t border-white/[0.08]">
              <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase">Replacement</div>
              <input
                className="w-full bg-white/5 border-t border-white/[0.08] px-2 py-1.5 text-xs font-mono outline-none"
                value={replaceString}
                onChange={(e) => setReplaceString(e.target.value)}
                placeholder="$& = full match, $1 = group 1..."
              />
            </div>
          )}

          {/* Common patterns */}
          <div className="border-t border-white/[0.08] p-2">
            <div className="text-[10px] text-os-text-muted uppercase mb-1">Common Patterns</div>
            <div className="flex flex-wrap gap-1">
              {commonPatterns.map((p) => (
                <button
                  key={p.name}
                  onClick={() => loadPattern(p.pattern, p.flags)}
                  className="px-2 py-0.5 rounded border border-white/10 text-[10px] text-os-text-muted hover:bg-white/10 hover:text-os-text-primary transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {mode === 'match' ? (
            <>
              <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase">Highlighted</div>
              <div className="flex-1 overflow-auto p-2 font-mono text-xs whitespace-pre-wrap border-b border-white/[0.08]">
                {highlightedText()}
              </div>

              <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase">Match Groups</div>
              <div className="flex-1 overflow-auto">
                {matches.length === 0 ? (
                  <div className="p-3 text-xs text-os-text-muted text-center">No matches</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-os-text-muted border-b border-white/[0.08]">
                        <th className="px-2 py-1 text-left">#</th>
                        <th className="px-2 py-1 text-left">Match</th>
                        <th className="px-2 py-1 text-left">Index</th>
                        <th className="px-2 py-1 text-left">Groups</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-2 py-1 text-os-text-muted">{i + 1}</td>
                          <td className="px-2 py-1 font-mono text-emerald-400">{m[0]}</td>
                          <td className="px-2 py-1 text-os-text-muted">{m.index}</td>
                          <td className="px-2 py-1 font-mono text-amber-300">
                            {m.length > 1 ? m.slice(1).join(', ') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase">Result</div>
              <div className="flex-1 overflow-auto p-2 font-mono text-xs whitespace-pre-wrap">
                {replaceResult || (
                  <span className="text-os-text-muted">{testString}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
