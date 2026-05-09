import { useState, useCallback, useEffect } from 'react';
import {
  Send,
  Plus,
  Trash2,
  Clock,
  History,
  Globe,
  AlertCircle,
  FileJson,
  Type,
  List,
} from 'lucide-react';

interface Header {
  key: string;
  value: string;
}

interface HistoryItem {
  id: string;
  method: string;
  url: string;
  timestamp: number;
  status?: number;
}

interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
}

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

function formatBody(body: string, contentType?: string): string {
  if (!body) return '';
  const ct = contentType || '';
  if (ct.includes('json') || body.trim().startsWith('{') || body.trim().startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch { return body; }
  }
  return body;
}

function syntaxHighlight(body: string, contentType?: string): string {
  const formatted = formatBody(body, contentType);
  if ((contentType || '').includes('html')) {
    return formatted
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(&lt;\/?)(\w+)(.*?)(&gt;)/g, '<span style="color:#f472b6">$1$2</span><span style="color:#94a3b8">$3</span><span style="color:#f472b6">$4</span>');
  }
  if ((contentType || '').includes('xml')) {
    return formatted
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(&lt;\/?)([\w-]+)(.*?)(&gt;)/g, '<span style="color:#f472b6">$1$2</span><span style="color:#94a3b8">$3</span><span style="color:#f472b6">$4</span>');
  }
  // JSON / default
  return formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(".*?")(\s*:\s*)/g, '<span style="color:#fbbf24">$1</span>$2')
    .replace(/: (".*?")/g, ': <span style="color:#34d399">$1</span>')
    .replace(/: (\d+(?:\.\d+)?)/g, ': <span style="color:#60a5fa">$1</span>')
    .replace(/: (true|false)/g, ': <span style="color:#c084fc">$1</span>')
    .replace(/: (null)/g, ': <span style="color:#94a3b8">$1</span>');
}

export default function APITester() {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/posts/1');
  const [headers, setHeaders] = useState<Header[]>([{ key: 'Content-Type', value: 'application/json' }]);
  const [bodyType, setBodyType] = useState<'raw' | 'json' | 'form'>('raw');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');

  useEffect(() => {
    const saved = localStorage.getItem('api-tester-history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveHistory = useCallback((items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem('api-tester-history', JSON.stringify(items.slice(0, 50)));
  }, []);

  const send = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    const start = performance.now();
    try {
      const headerObj: Record<string, string> = {};
      headers.forEach((h) => { if (h.key) headerObj[h.key] = h.value; });

      let reqBody: string | FormData | undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        if (bodyType === 'form') {
          const fd = new FormData();
          try {
            const pairs = body.split('\n');
            pairs.forEach((line) => {
              const [k, ...v] = line.split('=');
              if (k) fd.append(k.trim(), v.join('=').trim());
            });
          } catch { /* ignore */ }
          reqBody = fd;
        } else {
          reqBody = body || undefined;
        }
      }

      const res = await fetch(url, {
        method,
        headers: bodyType === 'form' && reqBody instanceof FormData ? {} : headerObj,
        body: reqBody,
      });

      const time = Math.round(performance.now() - start);
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });
      const resBody = await res.text();

      const resp: ResponseData = {
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: resBody,
        time,
      };

      setResponse(resp);

      const item: HistoryItem = {
        id: `req_${Date.now()}`,
        method,
        url,
        timestamp: Date.now(),
        status: res.status,
      };
      saveHistory([item, ...history].slice(0, 50));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      if (msg.includes('CORS')) {
        setError('CORS error: The server blocked this request. Try a CORS-enabled API or proxy.');
      } else if (msg.includes('Failed to fetch')) {
        setError('Network error: Unable to reach the server. Check URL or CORS policy.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [method, url, headers, body, bodyType, history, saveHistory]);

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }]);
  const removeHeader = (i: number) => setHeaders(headers.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) => {
    const next = [...headers];
    next[i][field] = val;
    setHeaders(next);
  };

  const replay = (item: HistoryItem) => {
    setMethod(item.method);
    setUrl(item.url);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('api-tester-history');
  };

  const statusColor = (s: number) => {
    if (s < 200) return 'text-gray-400';
    if (s < 300) return 'text-emerald-400';
    if (s < 400) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="flex h-full bg-[#0f172a] text-os-text-primary overflow-hidden">
      {/* Left: Request */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.08]">
        {/* URL bar */}
        <div className="h-11 flex items-center gap-2 px-2 border-b border-white/[0.08] flex-shrink-0">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-semibold outline-none focus:border-os-accent"
          >
            {methods.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-os-accent min-w-0"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
          />
          <button
            onClick={send}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-os-accent text-white text-xs font-semibold hover:bg-os-accent/90 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {loading ? '...' : 'Send'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.08]">
          <button
            onClick={() => setBodyType('raw')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${bodyType === 'raw' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'}`}
          >
            <Type className="w-3 h-3" /> Raw
          </button>
          <button
            onClick={() => setBodyType('json')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${bodyType === 'json' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'}`}
          >
            <FileJson className="w-3 h-3" /> JSON
          </button>
          <button
            onClick={() => setBodyType('form')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${bodyType === 'form' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'}`}
          >
            <List className="w-3 h-3" /> Form
          </button>
        </div>

        {/* Body editor */}
        {method !== 'GET' && method !== 'HEAD' && (
          <div className="flex-shrink-0 h-32 border-b border-white/[0.08]">
            <textarea
              className="w-full h-full bg-transparent p-2 font-mono text-xs resize-none outline-none text-os-text-primary"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={bodyType === 'form' ? 'key=value\nkey2=value2' : '{ "key": "value" }'}
              spellCheck={false}
            />
          </div>
        )}

        {/* Headers */}
        <div className="px-2 py-1 text-[10px] text-os-text-muted uppercase flex items-center justify-between">
          <span>Headers</span>
          <button onClick={addHeader} className="p-0.5 rounded hover:bg-white/10">
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-2">
          {headers.map((h, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-os-accent"
                value={h.key}
                onChange={(e) => updateHeader(i, 'key', e.target.value)}
                placeholder="Key"
              />
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-os-accent"
                value={h.value}
                onChange={(e) => updateHeader(i, 'value', e.target.value)}
                placeholder="Value"
              />
              <button onClick={() => removeHeader(i)} className="p-1 rounded hover:bg-white/10">
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Response + History */}
      <div className="flex-1 flex flex-col min-w-0">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        {response && (
          <div className="flex-shrink-0 border-b border-white/[0.08]">
            <div className="flex items-center gap-3 px-3 py-2">
              <span className={`text-sm font-bold ${statusColor(response.status)}`}>
                {response.status} {response.statusText}
              </span>
              <span className="flex items-center gap-1 text-xs text-os-text-muted">
                <Clock className="w-3 h-3" /> {response.time}ms
              </span>
              <div className="flex-1" />
              <button
                onClick={() => setActiveTab('body')}
                className={`text-xs px-2 py-0.5 rounded ${activeTab === 'body' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'}`}
              >
                Body
              </button>
              <button
                onClick={() => setActiveTab('headers')}
                className={`text-xs px-2 py-0.5 rounded ${activeTab === 'headers' ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'}`}
              >
                Headers
              </button>
            </div>
          </div>
        )}

        {response ? (
          <div className="flex-1 overflow-auto">
            {activeTab === 'body' ? (
              <pre
                className="p-3 font-mono text-xs whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(response.body, response.headers['content-type']) }}
              />
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(response.headers).map(([k, v]) => (
                    <tr key={k} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-3 py-1.5 text-os-text-muted font-medium w-1/3">{k}</td>
                      <td className="px-3 py-1.5 font-mono text-emerald-400">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-os-text-muted text-sm">
            <Globe className="w-8 h-8 mb-2 opacity-30" />
            <span>Send a request to see the response</span>
          </div>
        )}

        {/* History */}
        <div className="border-t border-white/[0.08] h-32 flex-shrink-0">
          <div className="flex items-center justify-between px-2 py-1 border-b border-white/[0.08]">
            <div className="flex items-center gap-1 text-[10px] text-os-text-muted uppercase">
              <History className="w-3 h-3" /> History
            </div>
            <button onClick={clearHistory} className="text-[10px] text-red-400 hover:text-red-300">
              Clear
            </button>
          </div>
          <div className="overflow-auto h-full pb-4">
            {history.length === 0 && (
              <div className="text-[11px] text-os-text-muted text-center py-3">No requests yet</div>
            )}
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => replay(item)}
                className="w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-white/5 text-left"
              >
                <span className={`text-[10px] font-semibold w-12 ${item.status ? statusColor(item.status) : 'text-os-text-muted'}`}>
                  {item.method}
                </span>
                <span className="flex-1 truncate text-os-text-muted">{item.url}</span>
                {item.status && (
                  <span className={`text-[10px] ${statusColor(item.status)}`}>{item.status}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
