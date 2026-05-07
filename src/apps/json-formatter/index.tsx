import { useState, useCallback, useEffect } from 'react';
import {
  Braces,
  Copy,
  Check,
  FileUp,
  FileDown,
  RotateCcw,
  TreePine,
  AlignLeft,
  AlignJustify,
  AlertCircle,
} from 'lucide-react';
import { fs } from '@/os/fs';

interface TreeNodeProps {
  label: string;
  value: unknown;
  depth: number;
}

function TreeNode({ label, value, depth }: TreeNodeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isObj = value !== null && typeof value === 'object';
  const isArr = Array.isArray(value);
  const children: { key: string; value: unknown }[] = isObj
    ? isArr
      ? (value as unknown[]).map((v, i) => ({ key: String(i), value: v }))
      : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v }))
    : [];
  const canCollapse = children.length > 0;

  const typeColor = (v: unknown): string => {
    if (v === null) return 'text-gray-400';
    if (typeof v === 'boolean') return 'text-purple-400';
    if (typeof v === 'number') return 'text-blue-400';
    if (typeof v === 'string') return 'text-emerald-400';
    return 'text-os-text-primary';
  };

  const typePreview = (v: unknown): string => {
    if (v === null) return 'null';
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return `"${v.length > 40 ? v.slice(0, 40) + '…' : v}"`;
    if (Array.isArray(v)) return `[${v.length}]`;
    return `{${Object.keys(v as Record<string, unknown>).length}}`;
  };

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-start gap-1">
        {canCollapse && (
          <button
            className="mt-0.5 text-[10px] text-os-text-muted hover:text-os-text-primary w-4"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        )}
        {!canCollapse && <span className="w-4" />}
        {label !== '' && (
          <span className="text-amber-300 text-xs whitespace-nowrap">
            {isArr ? '' : `"${label}"`}:
          </span>
        )}
        {isObj ? (
          <span className="text-xs text-os-text-muted">
            {typePreview(value)}
            {!collapsed && canCollapse && ' {'}
          </span>
        ) : (
          <span className={`text-xs ${typeColor(value)}`}>{typePreview(value)}</span>
        )}
      </div>
      {!collapsed && canCollapse && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.key}
              label={child.key}
              value={child.value}
              depth={depth + 1}
            />
          ))}
          <div style={{ marginLeft: depth * 16 }} className="text-os-text-muted text-xs">
            {'}'}
          </div>
        </div>
      )}
    </div>
  );
}

const sampleJSON = JSON.stringify(
  {
    users: [
      { id: 1, name: 'Alice', active: true, score: 95.5, tags: ['admin', 'dev'] },
      { id: 2, name: 'Bob', active: false, score: 72.0, tags: ['user'] },
    ],
    meta: { version: '1.0.0', count: 2, debug: null },
  },
  null,
  2
);

export default function JSONFormatter() {
  const [input, setInput] = useState(sampleJSON);
  const [output, setOutput] = useState(sampleJSON);
  const [mode, setMode] = useState<'formatted' | 'tree' | 'minified'>('formatted');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const validate = useCallback((text: string) => {
    try {
      JSON.parse(text);
      setError(null);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      const lineMatch = msg.match(/line\s*(\d+)/i);
      const line = lineMatch ? lineMatch[1] : '?';
      setError(`Parse error at line ${line}: ${msg}`);
      return false;
    }
  }, []);

  useEffect(() => {
    validate(input);
  }, [input, validate]);

  const format = useCallback(() => {
    if (!validate(input)) return;
    const formatted = JSON.stringify(JSON.parse(input), null, 2);
    setOutput(formatted);
    setMode('formatted');
  }, [input, validate]);

  const minify = useCallback(() => {
    if (!validate(input)) return;
    const minified = JSON.stringify(JSON.parse(input));
    setOutput(minified);
    setMode('minified');
  }, [input, validate]);

  const tree = useCallback(() => {
    if (!validate(input)) return;
    setOutput(input);
    setMode('tree');
  }, [input, validate]);

  const copyOutput = useCallback(() => {
    let text = output;
    if (mode === 'tree') text = JSON.stringify(JSON.parse(input), null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output, mode, input]);

  const loadFile = useCallback(() => {
    const path = prompt('Enter file path:');
    if (!path) return;
    const data = fs.readFile(path);
    if (data && typeof data === 'string') {
      setInput(data);
    } else {
      alert('File not found or not text');
    }
  }, []);

  const saveFile = useCallback(() => {
    const path = prompt('Save as (e.g. /home/user/Documents/data.json):');
    if (!path) return;
    let text = output;
    if (mode === 'tree') text = JSON.stringify(JSON.parse(input), null, 2);
    fs.writeFile(path, text, 'application/json');
    alert('Saved to ' + path);
  }, [output, mode, input]);

  const loadSample = useCallback(() => {
    setInput(sampleJSON);
    setOutput(sampleJSON);
    setMode('formatted');
  }, []);

  const highlightJSON = (json: string) => {
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(".*?")(\s*:\s*)/g, '<span class="text-amber-300">$1</span>$2')
      .replace(/: (".*?")/g, ': <span class="text-emerald-400">$1</span>')
      .replace(/: (\d+(?:\.\d+)?)/g, ': <span class="text-blue-400">$1</span>')
      .replace(/: (true|false)/g, ': <span class="text-purple-400">$1</span>')
      .replace(/: (null)/g, ': <span class="text-gray-400">$1</span>');
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-os-text-primary">
      {/* Toolbar */}
      <div className="h-10 flex items-center gap-1 px-2 border-b border-white/[0.08] flex-shrink-0">
        <button onClick={format} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <AlignLeft className="w-3.5 h-3.5" /> Format
        </button>
        <button onClick={minify} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <AlignJustify className="w-3.5 h-3.5" /> Minify
        </button>
        <button onClick={tree} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <TreePine className="w-3.5 h-3.5" /> Tree
        </button>
        <button onClick={loadSample} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <RotateCcw className="w-3.5 h-3.5" /> Sample
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button onClick={loadFile} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <FileUp className="w-3.5 h-3.5" /> Load
        </button>
        <button onClick={saveFile} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs">
          <FileDown className="w-3.5 h-3.5" /> Save
        </button>
        <button onClick={copyOutput} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-xs ml-auto">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Split pane */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col border-r border-white/[0.08] min-w-0">
          <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase tracking-wider flex items-center gap-1">
            <Braces className="w-3 h-3" /> Input
          </div>
          <textarea
            className="flex-1 bg-transparent p-2 font-mono text-xs resize-none outline-none text-os-text-primary"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase tracking-wider">
            {mode === 'tree' ? 'Tree View' : mode === 'minified' ? 'Minified' : 'Formatted'}
          </div>
          <div className="flex-1 overflow-auto p-2">
            {mode === 'tree' ? (
              <div className="font-mono text-xs">
                <TreeNode label="" value={JSON.parse(input || '{}')} depth={0} />
              </div>
            ) : (
              <pre
                className="font-mono text-xs whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: highlightJSON(output) }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
