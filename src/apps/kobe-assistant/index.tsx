import { useState, useRef, useEffect, useCallback } from 'react';
import { api, apiArray, apiObject, apiSse, ApiError } from '@/lib/api';
import { useOSStore } from '@/os/store';
import {
  Sparkles, Send, Loader2, User, CheckCircle2, Printer, Mic,
  Volume2, VolumeX, Paperclip, Wrench,
} from 'lucide-react';

/** Strip emoji/markdown so the spoken reply sounds natural. */
function speakable(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface PendingAction { tool: string; summary: string; args: Record<string, unknown> }
interface BriefingAlert { severity: 'info' | 'warning'; text: string; action?: { label: string; tool?: string; args?: Record<string, unknown>; endpoint?: string; method?: 'POST' | 'PUT' } }
interface AssistantCitation { kind: 'tool' | 'document' | 'memory' | 'screen'; label: string; ref?: string; detail?: string }
interface ScreenContext {
  appId?: string;
  module?: string;
  screenLabel?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  fields?: Record<string, unknown>;
}
interface Msg {
  role: 'user' | 'assistant';
  content: string;
  data?: unknown;
  pending?: PendingAction | null;
  alerts?: BriefingAlert[];
  confidence?: number;
  citations?: AssistantCitation[];
  needsVerification?: boolean;
}
interface AssistantSkill {
  name: string;
  description: string;
  write: boolean;
  kind?: 'read' | 'action';
  domains?: string[];
}
interface AssistantActivity {
  stage: 'understanding' | 'retrieving' | 'routing' | 'checking_data' | 'preparing_action' | 'thinking' | 'responding';
  label: string;
  detail?: string;
}
interface KnowledgeStatus {
  skills: number;
  documents: number;
  documentPassages: number;
  indexedBusinessRecords: number;
  rememberedFacts: number;
  sources?: Array<{ id: string; label: string; ready: boolean; count?: number }>;
}

const FALLBACK_SKILLS: AssistantSkill[] = [
  { name: 'sales_today', description: 'Today’s orders and sales revenue.', write: false },
  { name: 'low_stock', description: 'Products and warehouse items that need restocking.', write: false },
  { name: 'unpaid_tenants', description: 'Outstanding rent and tenants who have not paid.', write: false },
  { name: 'hotel_occupancy', description: 'Occupied, reserved and available hotel rooms.', write: false },
  { name: 'hotel_revenue', description: 'Hotel revenue, expenses and profit.', write: false },
  { name: 'cargo_status', description: 'Parcel totals and current delivery statuses.', write: false },
  { name: 'record_rent_payment', description: 'Prepare a rent payment for confirmation.', write: true },
  { name: 'add_tenant', description: 'Prepare a new tenant record for confirmation.', write: true },
  { name: 'create_booking', description: 'Prepare a hotel booking for confirmation.', write: true },
  { name: 'adjust_stock', description: 'Prepare a stock-level change for confirmation.', write: true },
];

function localBasicReply(question: string): string {
  const q = question.trim().toLowerCase();
  if (/^(hi|hello|hey|habari|mambo)[!. ]*$/.test(q)) {
    return 'Hello! I’m Kobe. I can help with sales, properties, hotels, stock, cargo, expenses and everyday questions.';
  }
  const arithmetic = q.match(/(?:what is|calculate)\s+(-?\d+(?:\.\d+)?)\s*([+\-*/x×÷])\s*(-?\d+(?:\.\d+)?)/);
  if (arithmetic) {
    const left = Number(arithmetic[1]);
    const right = Number(arithmetic[3]);
    const operator = arithmetic[2];
    const answer =
      operator === '+' ? left + right :
        operator === '-' ? left - right :
          operator === '*' || operator === 'x' || operator === '×' ? left * right :
            right === 0 ? NaN : left / right;
    return Number.isFinite(answer) ? `${left} ${operator} ${right} = ${answer}` : 'That calculation is undefined.';
  }
  if (/\b(what can you do|skills|help)\b/.test(q)) {
    return 'I can answer general questions and work with sales, properties, rent, hotels, inventory, expenses and cargo. Open Skills above to see every available business tool.';
  }
  return 'The assistant service is reconnecting. I can still help with basic questions; live business answers will resume when Kobe Cloud is reachable.';
}

/** Find the first array-of-objects inside a tool result, for printing as a table. */
function firstRows(data: unknown): Record<string, unknown>[] | null {
  if (!data || typeof data !== 'object') return null;
  for (const v of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
      return v as Record<string, unknown>[];
    }
  }
  return null;
}

/** Open a clean printable table (works in Electron + browser). */
function printReport(rows: Record<string, unknown>[], title: string) {
  const cols = Object.keys(rows[0]);
  const esc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const html =
    `<html><head><title>${esc(title)}</title><style>` +
    `body{font-family:system-ui,sans-serif;padding:28px;color:#111}h1{font-size:18px;margin:0 0 4px}` +
    `.ts{color:#666;font-size:12px;margin:0 0 16px}table{border-collapse:collapse;width:100%;font-size:13px}` +
    `th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f3f3f3}` +
    `</style></head><body><h1>${esc(title)}</h1><p class="ts">KobeOS · ${esc(new Date().toLocaleString())}</p>` +
    `<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>` +
    `</body></html>`;
  const w = window.open('', '_blank', 'width=820,height=640');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

const DEFAULT_SUGGESTIONS = [
  'What are today’s sales?',
  'Which items do customers like most?',
  'How many tenants haven’t paid rent?',
  'How much did I spend this month?',
  'How many parcels are in transit?',
];

// Suggestions tailored to the module the co-pilot was opened from, so the
// prompts are relevant to what the user is doing right now.
const PROMPTS_BY_APP: Record<string, string[]> = {
  'erp-pos': ['What are today’s sales?', 'Which items sell the most?', 'Show me low-stock products', 'Add a new product'],
  'posys': ['What are today’s sales?', 'Which items sell the most?', 'Show me low-stock products'],
  'pos-kds': ['What are today’s sales?', 'Which items sell the most?'],
  'property': ['How many tenants haven’t paid rent?', 'Remind tenants about rent automatically', 'Send me a daily report every morning', 'Record a rent payment'],
  'kobe-hotel': ['What’s my hotel occupancy right now?', 'This month’s hotel revenue and profit', 'Book a room for a guest', 'Set a room to maintenance'],
  'erp-warehouse': ['Show me low-stock warehouse items', 'What’s my total stock value?', 'Set stock for an item'],
  'erp-warehouse-ops': ['Show me low-stock warehouse items', 'What’s my total stock value?'],
  'cargo': ['How many parcels are in transit?', 'How many parcels were delivered?'],
  'erp-shop': ['Which items do customers like most?', 'Find products like “cheap kids kit”', 'Show me low-stock products', 'Write a promo for a jersey sale'],
  'erp-store-editor': ['Which items do customers like most?', 'Write a promo for a sale'],
  'kobe-pay': ['What are today’s sales?', 'How much did I spend this month?'],
  'erp-dashboard': ['What are today’s sales?', 'Project this month’s sales', 'How much did I spend this month?', 'How many tenants haven’t paid rent?'],
  'erp-summary': ['What are today’s sales?', 'How much did I spend this month?'],
  'erp-reports': ['What are today’s sales?', 'How much did I spend this month?'],
  'erp-eod': ['What are today’s sales?', 'How much did I spend this month?'],
  'erp-accounting': ['How much did I spend this month?', 'What are today’s sales?'],
};

export default function KobeAssistant({
  contextLabel,
  appId,
  responseMode = 'quality',
}: {
  contextLabel?: string;
  appId?: string;
  responseMode?: 'fast' | 'quality';
} = {}) {
  const suggestions = (appId && PROMPTS_BY_APP[appId]) || DEFAULT_SUGGESTIONS;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [skills, setSkills] = useState<AssistantSkill[]>(FALLBACK_SKILLS);
  const [knowledge, setKnowledge] = useState<KnowledgeStatus | null>(null);
  const [activity, setActivity] = useState<AssistantActivity | null>(null);
  const [screenContext, setScreenContext] = useState<ScreenContext>({
    appId,
    module: appId,
    screenLabel: contextLabel,
  });
  const [showSkills, setShowSkills] = useState(false);
  // Voice mode: read Kobe's replies aloud, and auto-send after dictation (hands-free).
  const [voice, setVoice] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const spokenRef = useRef(-1);        // index of the last message read aloud
  const voiceRef = useRef(false);      // latest `voice` for use inside recognition callbacks
  voiceRef.current = voice;

  const TTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const speak = useCallback((text: string) => {
    if (!TTS) return;
    const clean = speakable(text);
    if (!clean) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean.slice(0, 500));
      u.lang = navigator.language || 'en-US';
      window.speechSynthesis.speak(u);
    } catch { /* TTS best-effort */ }
  }, [TTS]);

  // Voice input via the Web Speech API (works in Electron/Chromium + Chrome/Edge
  // PWA). Dictates into the input; the user reviews and sends.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const toggleVoice = () => {
    if (!SR) return;
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let heard = '';
    r.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      heard = text;
      setInput(text);
    };
    // Hands-free: when voice mode is on, send what was dictated as soon as the
    // user stops speaking, so they never have to touch the keyboard.
    r.onend = () => { setListening(false); if (voiceRef.current && heard.trim()) send(heard); };
    r.onerror = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  // Read the newest assistant reply aloud when voice mode is on.
  useEffect(() => {
    if (!voice || busy) return;
    const last = messages.length - 1;
    if (last < 0 || last === spokenRef.current) return;
    const m = messages[last];
    if (m.role === 'assistant' && m.content) { spokenRef.current = last; speak(m.content); }
  }, [messages, voice, speak, busy]);

  // Stop any speech when voice mode is switched off.
  useEffect(() => { if (!voice && TTS) window.speechSynthesis.cancel(); }, [voice, TTS]);

  // Any KobeOS module can publish its currently selected record without coupling
  // the assistant to that module. Example:
  // window.dispatchEvent(new CustomEvent('kobe:screen-context', { detail: { entityType:'tenant', entityId, entityLabel:name } }))
  useEffect(() => {
    const onContext = (event: Event) => {
      const detail = (event as CustomEvent<ScreenContext>).detail || {};
      setScreenContext((current) => ({ ...current, ...detail }));
    };
    window.addEventListener('kobe:screen-context', onContext as EventListener);
    return () => window.removeEventListener('kobe:screen-context', onContext as EventListener);
  }, []);

  useEffect(() => {
    setScreenContext((current) => ({ ...current, appId, module: appId, screenLabel: contextLabel }));
  }, [appId, contextLabel]);

  // Proactive daily briefing: greet the user with their business status + alerts
  // when the assistant opens. Deterministic on the backend, so it works even
  // when the AI model is offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api<unknown>('/ai/briefing', { offlineFallback: false });
        const b = apiObject<{ summary: string; alerts?: BriefingAlert[] }>(response);
        if (cancelled || !b || typeof b.summary !== 'string' || !b.summary.trim()) return;
        setMessages((p) => (p.length ? p : [{ role: 'assistant', content: `👋 ${b.summary}`, alerts: b.alerts ?? [] }]));
      } catch { /* briefing is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api<unknown>('/ai/skills', { offlineFallback: false }),
      api<KnowledgeStatus>('/ai/knowledge', { offlineFallback: false }),
    ]).then(([skillResult, knowledgeResult]) => {
      if (cancelled) return;
      if (skillResult.status === 'fulfilled') {
        const available = apiArray<AssistantSkill>(skillResult.value, ['skills'])
          .filter((skill) => skill && typeof skill.name === 'string' && typeof skill.description === 'string');
        if (available.length) setSkills(available);
      }
      if (knowledgeResult.status === 'fulfilled') setKnowledge(knowledgeResult.value);
    }).catch(() => { /* embedded skills remain visible while offline */ });
    return () => { cancelled = true; };
  }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;

    const workflowMatch = q.match(/^\/workflow\s+(.+)$/is);
    if (workflowMatch) {
      setBusy(true);
      setActivity({ stage: 'thinking', label: 'Building an editable workflow plan…' });
      try {
        const plan = await api<{ id: string; title: string; status: string; steps: Array<{ title: string }> }>('/ai/operating/workflows', {
          method: 'POST',
          body: JSON.stringify({ objective: workflowMatch[1], context: screenContext }),
          offlineFallback: false,
        });
        setMessages((p) => [...p, { role: 'user', content: q }, {
          role: 'assistant',
          content: `Created workflow “${plan.title}” with ${plan.steps.length} step(s). Status: ${plan.status}. Open Kobe Agents → AI Operating Layer to edit or approve it.`,
          confidence: 1,
          citations: [{ kind: 'tool', label: 'workflow planner', ref: plan.id }],
        }]);
        setInput('');
      } catch (cause) {
        setMessages((p) => [...p, { role: 'user', content: q }, { role: 'assistant', content: `Could not create workflow: ${cause instanceof Error ? cause.message : 'unknown error'}`, confidence: 1 }]);
      } finally { setBusy(false); setActivity(null); }
      return;
    }

    const dashboardMatch = q.match(/^\/dashboard\s+(.+)$/is);
    if (dashboardMatch) {
      setBusy(true);
      setActivity({ stage: 'thinking', label: 'Designing your dashboard…' });
      try {
        const dashboard = await api<{ id: string; name: string; widgets: unknown[] }>('/ai/operating/dashboards', {
          method: 'POST',
          body: JSON.stringify({ prompt: dashboardMatch[1] }),
          offlineFallback: false,
        });
        setMessages((p) => [...p, { role: 'user', content: q }, {
          role: 'assistant',
          content: `Created “${dashboard.name}” with ${dashboard.widgets.length} widget(s). It is saved in Kobe Agents → AI Operating Layer → Dashboards.`,
          confidence: 1,
          citations: [{ kind: 'tool', label: 'dashboard generator', ref: dashboard.id }],
        }]);
        setInput('');
      } catch (cause) {
        setMessages((p) => [...p, { role: 'user', content: q }, { role: 'assistant', content: `Could not create dashboard: ${cause instanceof Error ? cause.message : 'unknown error'}`, confidence: 1 }]);
      } finally { setBusy(false); setActivity(null); }
      return;
    }

    const simulationMatch = q.match(/^\/simulate\s+(.+)$/is);
    if (simulationMatch) {
      const raw = simulationMatch[1].toLowerCase();
      const pct = (label: string) => {
        const match = raw.match(new RegExp(`${label}\\s*([+-]?\\d+(?:\\.\\d+)?)%?`, 'i'));
        return match ? Number(match[1]) : undefined;
      };
      const scenario = {
        salesChangePct: pct('sales'),
        expenseChangePct: pct('expenses?'),
        rentCollectionChangePct: pct('rent'),
        roomRateChangePct: pct('rooms?|room rate|hotel'),
      };
      setBusy(true);
      setActivity({ stage: 'checking_data', label: 'Running scenario against current business data…' });
      try {
        const result = await api<Record<string, unknown>>('/ai/operating/simulate', {
          method: 'POST',
          body: JSON.stringify(scenario),
          offlineFallback: false,
        });
        setMessages((p) => [...p, { role: 'user', content: q }, {
          role: 'assistant',
          content: `Scenario result:\n${JSON.stringify(result, null, 2)}`,
          data: result,
          confidence: typeof result.confidence === 'number' ? result.confidence : 0.65,
          citations: [{ kind: 'tool', label: 'business simulation', ref: 'simulate' }],
          needsVerification: true,
        }]);
        setInput('');
      } catch (cause) {
        setMessages((p) => [...p, { role: 'user', content: q }, { role: 'assistant', content: `Could not run simulation: ${cause instanceof Error ? cause.message : 'unknown error'}`, confidence: 1 }]);
      } finally { setBusy(false); setActivity(null); }
      return;
    }

    const openMatch = q.match(/^\/(?:open|go)\s+(.+)$/i) || q.match(/^open\s+app\s+(.+)$/i);
    if (openMatch) {
      const wanted = openMatch[1].trim().toLowerCase();
      const state = useOSStore.getState();
      const app = state.apps.find((item) =>
        item.id.toLowerCase() === wanted ||
        item.name.toLowerCase() === wanted ||
        item.name.toLowerCase().includes(wanted),
      );
      if (app) {
        state.launchApp(app.id);
        setMessages((p) => [...p, { role: 'user', content: q }, { role: 'assistant', content: `Opened ${app.name}.`, confidence: 1, citations: [] }]);
      } else {
        setMessages((p) => [...p, { role: 'user', content: q }, { role: 'assistant', content: `I couldn't find a KobeOS app matching “${openMatch[1]}”.`, confidence: 1, citations: [] }]);
      }
      setInput('');
      return;
    }
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const ctx = contextLabel
      ? [{ role: 'user' as const, content: `[context] The user is currently working in the "${contextLabel}" module.` }]
      : [];

    setMessages((p) => [
      ...p,
      { role: 'user', content: q },
      { role: 'assistant', content: '' },
    ]);
    setInput('');
    setBusy(true);
    setActivity({ stage: 'understanding', label: 'Understanding your request…' });

    let streamed = '';
    const streamState: {
      done?: {
        reply?: string;
        data?: unknown;
        pendingAction?: PendingAction | null;
        confidence?: number;
        citations?: AssistantCitation[];
        needsVerification?: boolean;
      };
      error?: string;
    } = {};

    const updateStreamingReply = (content: string, meta?: {
      data?: unknown;
      pendingAction?: PendingAction | null;
      confidence?: number;
      citations?: AssistantCitation[];
      needsVerification?: boolean;
    }) => {
      setMessages((p) => {
        const next = [...p];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].role !== 'assistant') continue;
          next[i] = {
            ...next[i],
            content,
            ...(meta ? {
              data: meta.data,
              pending: meta.pendingAction ?? null,
              confidence: meta.confidence,
              citations: meta.citations,
              needsVerification: meta.needsVerification,
            } : {}),
          };
          break;
        }
        return next;
      });
    };

    try {
      try {
        await apiSse('/ai/assistant/stream', {
          method: 'POST',
          body: JSON.stringify({
            message: q,
            history: [...ctx, ...history],
            mode: responseMode,
            context: {
              ...screenContext,
              appId: screenContext.appId || appId,
              module: screenContext.module || appId,
              screenLabel: screenContext.screenLabel || contextLabel,
            },
          }),
        }, (event, data) => {
          const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
          if (event === 'activity' && typeof record.label === 'string') {
            setActivity(record as unknown as AssistantActivity);
          } else if (event === 'token' && typeof record.token === 'string') {
            streamed += record.token;
            setActivity({ stage: 'responding', label: 'Writing the answer…' });
            updateStreamingReply(streamed);
          } else if (event === 'done') {
            streamState.done = record as {
              reply?: string;
              data?: unknown;
              pendingAction?: PendingAction | null;
              confidence?: number;
              citations?: AssistantCitation[];
              needsVerification?: boolean;
            };
          } else if (event === 'error') {
            streamState.error = typeof record.message === 'string' ? record.message : 'Streaming failed.';
          }
        });
        if (streamState.error) throw new Error(streamState.error);
        const finalReply = streamed.trim() || streamState.done?.reply?.trim() || '';
        if (!finalReply) throw new Error('The assistant returned an empty response.');
        updateStreamingReply(finalReply, {
          data: streamState.done?.data,
          pendingAction: streamState.done?.pendingAction ?? null,
          confidence: streamState.done?.confidence,
          citations: streamState.done?.citations,
          needsVerification: streamState.done?.needsVerification,
        });
      } catch (streamFailure) {
        let reply = '';
        try {
          const response = await api<unknown>('/ai/assistant', {
            method: 'POST',
            body: JSON.stringify({
              message: q,
              history: [...ctx, ...history],
              mode: responseMode,
              context: {
                ...screenContext,
                appId: screenContext.appId || appId,
                module: screenContext.module || appId,
                screenLabel: screenContext.screenLabel || contextLabel,
              },
            }),
            offlineFallback: false,
          });
          const r = apiObject<{
            reply: string;
            data?: unknown;
            pendingAction?: PendingAction | null;
            confidence?: number;
            citations?: AssistantCitation[];
            needsVerification?: boolean;
          }>(response);
          reply = r?.reply?.trim() ?? '';
          if (reply) {
            updateStreamingReply(reply, {
              data: r?.data,
              pendingAction: r?.pendingAction ?? null,
              confidence: r?.confidence,
              citations: r?.citations,
              needsVerification: r?.needsVerification,
            });
          }
        } catch (e) {
          if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
            try {
              const fallbackResponse = await api<unknown>('/ai/chat', {
                method: 'POST',
                body: JSON.stringify({
                  messages: [
                    { role: 'system', content: 'You are Kobe, a helpful and concise general business assistant.' },
                    ...history,
                    { role: 'user', content: q },
                  ],
                  mode: responseMode,
                }),
                offlineFallback: false,
              });
              const fallback = apiObject<{ content?: string }>(fallbackResponse);
              reply = fallback?.content?.trim() ?? '';
            } catch { /* deterministic fallback below */ }
          }
        }
        if (!reply) reply = streamed.trim() || localBasicReply(q);
        updateStreamingReply(reply);
        if (!streamed && streamFailure instanceof Error) {
          console.warn('Kobe streaming fallback:', streamFailure.message);
        }
      }
    } finally {
      setBusy(false);
      setActivity(null);
    }
  };

  // Read a File as a base64 string (no data: prefix) for the vision endpoint.
  const readAsBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).replace(/^data:[^;]+;base64,/, ''));
    fr.onerror = () => reject(new Error('Could not read the file.'));
    fr.readAsDataURL(file);
  });

  // Attach a photo (→ vision skill) or a document (→ chat-with-documents).
  const onAttach = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      if (file.type.startsWith('image/')) {
        setMessages((p) => [...p, { role: 'user', content: `📷 ${file.name}` }]);
        setActivity({ stage: 'retrieving', label: 'Reading image and visible text…' });
        const b64 = await readAsBase64(file);
        const receiptLike = /receipt|invoice|bill|risiti|ankara/i.test(file.name);
        const [visionResult, ocrResult] = await Promise.allSettled([
          api<{ content: string }>('/ai/vision/describe', {
            method: 'POST',
            body: JSON.stringify({
              image: b64,
              prompt: 'Analyse this business image. Transcribe important visible text, numbers and labels. If it is a product suggest a name/category; if it is a receipt/invoice identify merchant, amount/date if visible. Clearly mark anything uncertain.',
            }),
            offlineFallback: false,
          }),
          api<{
            text: string;
            confidence: number;
            parsed?: { total: number | null; currency: string | null; date: string | null; merchant: string | null };
          }>(receiptLike ? '/ocr/extract-receipt-base64' : '/ocr/extract-base64', {
            method: 'POST',
            body: JSON.stringify({ image: b64, lang: 'eng+swa' }),
            offlineFallback: false,
          }),
        ]);
        const vision = visionResult.status === 'fulfilled' ? visionResult.value.content?.trim() : '';
        const ocr = ocrResult.status === 'fulfilled' ? ocrResult.value : null;
        const ocrText = ocr?.text?.trim() || '';
        let learned = false;
        let docTitle = file.name.replace(/\.[^.]+$/, '');
        if (ocrText.length >= 20 && Number(ocr?.confidence || 0) >= 55) {
          setActivity({ stage: 'retrieving', label: 'Adding high-confidence scan text to business knowledge…' });
          const doc = await api<{ title: string; chunkCount: number }>('/ai/docs', {
            method: 'POST',
            body: JSON.stringify({
              title: docTitle,
              text: ocrText,
              source: `scan:${file.name};ocr-confidence:${Math.round(Number(ocr?.confidence || 0))}`,
            }),
            offlineFallback: false,
          }).catch(() => null);
          learned = Boolean(doc?.chunkCount);
          if (doc?.title) docTitle = doc.title;
        }
        const parsed = ocr?.parsed;
        const parsedLine = parsed && (parsed.total != null || parsed.merchant || parsed.date)
          ? `\n\nParsed scan: ${[
              parsed.merchant ? `merchant ${parsed.merchant}` : '',
              parsed.total != null ? `total ${parsed.currency || ''} ${parsed.total.toLocaleString()}` : '',
              parsed.date ? `date ${parsed.date}` : '',
            ].filter(Boolean).join(' · ')}`
          : '';
        const ocrLine = ocrText
          ? `\n\nOCR (${Math.round(Number(ocr?.confidence || 0))}%):\n${ocrText.slice(0, 1800)}`
          : '';
        const learnedLine = learned ? `\n\n📚 Saved “${docTitle}” to Kobe knowledge for future questions.` : '';
        const reply = (vision || 'I could not visually describe that image.') + parsedLine + ocrLine + learnedLine;
        setMessages((p) => [...p, {
          role: 'assistant',
          content: reply,
          confidence: ocrText ? Math.max(0.5, Math.min(0.99, Number(ocr?.confidence || 0) / 100)) : 0.6,
          citations: learned ? [{ kind: 'document', label: docTitle }] : [],
          needsVerification: Boolean(ocrText && Number(ocr?.confidence || 0) < 75),
        }]);
      } else if (/\.(txt|md|csv|json|log|tsv|html?)$/i.test(file.name) || file.type.startsWith('text/')) {
        const text = await file.text();
        if (!text.trim()) throw new Error('That file looks empty.');
        setMessages((p) => [...p, { role: 'user', content: `📄 ${file.name}` }]);
        const doc = await api<{ title: string; chunkCount: number }>('/ai/docs', {
          method: 'POST',
          body: JSON.stringify({ title: file.name.replace(/\.[^.]+$/, ''), text, source: file.name }),
        });
        setMessages((p) => [...p, { role: 'assistant', content: `📚 Learned from “${doc.title}” (${doc.chunkCount} passage${doc.chunkCount === 1 ? '' : 's'}). Ask me anything about it.` }]);
      } else {
        setMessages((p) => [...p, { role: 'assistant', content: 'I can read photos and text files (.txt, .md, .csv). For a PDF, paste its text or export it as text and attach that.' }]);
      }
    } catch (e) {
      setMessages((p) => [...p, { role: 'assistant', content: `Attachment failed: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  // Run a briefing alert's action: either an assistant tool or a direct endpoint.
  const runAlertAction = async (a: NonNullable<BriefingAlert['action']>, idx: number) => {
    if (a.endpoint) {
      setBusy(true);
      // Drop the alert so it can't be double-run.
      setMessages((p) => p.map((m, i) => (i === idx ? { ...m, alerts: (m.alerts ?? []).filter((x) => x.action !== a) } : m)));
      try {
        const r = await api<{ ok?: boolean; message?: string }>(a.endpoint, {
          method: a.method ?? 'POST',
          offlineFallback: false,
        });
        setMessages((p) => [...p, { role: 'assistant', content: '✅ ' + (r?.message ?? 'Done.') }]);
      } catch (e) {
        setMessages((p) => [...p, { role: 'assistant', content: `Action failed: ${(e as Error).message}` }]);
      } finally { setBusy(false); }
      return;
    }
    if (a.tool) confirmAction({ tool: a.tool, summary: a.label, args: a.args ?? {} }, idx);
  };

  const confirmAction = async (action: PendingAction, idx: number) => {
    setBusy(true);
    setMessages((p) => p.map((m, i) => (i === idx ? { ...m, pending: null } : m))); // prevent double-run
    try {
      const r = await api<{ ok: boolean; message: string }>('/ai/assistant/execute', {
        method: 'POST',
        body: JSON.stringify({ tool: action.tool, args: action.args }),
        offlineFallback: false,
      });
      setMessages((p) => [...p, { role: 'assistant', content: (r.ok ? '✅ ' : '⚠ ') + r.message }]);
    } catch (e) {
      setMessages((p) => [...p, { role: 'assistant', content: `Action failed: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c1a] text-white/90">
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center"><Sparkles className="w-4 h-4" /></div>
        <div className="flex-1"><div className="text-sm font-semibold">Ask Kobe</div><div className="text-[10px] text-white/40">{contextLabel ? `Working in ${contextLabel} · local AI` : 'Chat with your business · runs on your local AI'}</div></div>
        <button
          type="button"
          onClick={() => setShowSkills((visible) => !visible)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-white/70 hover:bg-white/[0.09] hover:text-white"
        >
          <Wrench className="h-3.5 w-3.5" /> Skills {skills.length}
        </button>
        {TTS && (
          <button
            type="button"
            onClick={() => setVoice((v) => !v)}
            title={voice ? 'Voice mode on — Kobe speaks replies and auto-sends dictation' : 'Turn on voice mode'}
            className={`h-8 w-8 grid place-items-center rounded-lg ${voice ? 'bg-indigo-600 text-white' : 'bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-white'}`}
          >
            {voice ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {showSkills && (
          <section className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.08] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-indigo-100">Available business skills</p>
              <span className="text-[9px] text-white/40">Actions require confirmation</span>
            </div>
            {knowledge && (
              <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <div className="rounded-lg bg-black/15 px-2 py-1.5"><div className="text-sm font-bold text-white">{knowledge.skills}</div><div className="text-[9px] text-white/40">skills</div></div>
                <div className="rounded-lg bg-black/15 px-2 py-1.5"><div className="text-sm font-bold text-white">{knowledge.documents}</div><div className="text-[9px] text-white/40">documents</div></div>
                <div className="rounded-lg bg-black/15 px-2 py-1.5"><div className="text-sm font-bold text-white">{knowledge.indexedBusinessRecords}</div><div className="text-[9px] text-white/40">indexed records</div></div>
                <div className="rounded-lg bg-black/15 px-2 py-1.5"><div className="text-sm font-bold text-white">{knowledge.rememberedFacts}</div><div className="text-[9px] text-white/40">remembered facts</div></div>
              </div>
            )}
            <div className="grid gap-1.5 sm:grid-cols-2">
              {skills.map((skill) => (
                <div key={skill.name} className="rounded-lg border border-white/[0.07] bg-black/10 px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-white/85">{skill.name.replace(/_/g, ' ')}</span>
                    {skill.write && <span className="rounded bg-amber-400/15 px-1 py-0.5 text-[8px] font-bold text-amber-200">CONFIRM</span>}
                    {skill.domains?.slice(0, 2).map((domain) => (
                      <span key={domain} className="rounded bg-indigo-400/10 px-1 py-0.5 text-[8px] text-indigo-200/70">{domain}</span>
                    ))}
                  </div>
                  <p className="mt-1 text-[9px] leading-3.5 text-white/45">{skill.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'assistant' && <div className="w-6 h-6 rounded-md bg-indigo-500/20 grid place-items-center shrink-0"><Sparkles className="w-3.5 h-3.5 text-indigo-300" /></div>}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white/[0.05] border border-white/[0.06]'}`}>
              <div className="whitespace-pre-wrap leading-snug">{m.content}</div>
              {m.role === 'assistant' && m.needsVerification && (
                <div className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1.5 text-[10px] text-amber-100">
                  Low-confidence result — verify before using it for an important decision.
                </div>
              )}
              {m.role === 'assistant' && (m.citations?.length || typeof m.confidence === 'number') && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {typeof m.confidence === 'number' && (
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-white/45">
                      {Math.round(m.confidence * 100)}% confidence
                    </span>
                  )}
                  {m.citations?.slice(0, 6).map((citation, ci) => (
                    <span
                      key={`${citation.kind}-${citation.ref || citation.label}-${ci}`}
                      title={citation.detail || citation.ref || citation.label}
                      className="rounded-full border border-indigo-400/15 bg-indigo-400/[0.08] px-2 py-0.5 text-[9px] text-indigo-100/70"
                    >
                      {citation.kind === 'document' ? '📄 ' : citation.kind === 'memory' ? '🧠 ' : citation.kind === 'screen' ? '◉ ' : '↗ '}
                      {citation.label}
                    </span>
                  ))}
                </div>
              )}
              {m.alerts && m.alerts.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {m.alerts.map((a, ai) => (
                    <div key={ai} className={`rounded-lg border p-2 ${a.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/[0.04]'}`}>
                      <div className={`text-[11px] ${a.severity === 'warning' ? 'text-amber-200/90' : 'text-white/70'}`}>{a.severity === 'warning' ? '⚠ ' : 'ℹ '}{a.text}</div>
                      {a.action && (
                        <button
                          className="mt-1.5 text-[11px] font-bold px-3 py-1.5 rounded bg-amber-500 text-black inline-flex items-center gap-1 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => runAlertAction(a.action!, i)}
                        >
                          <CheckCircle2 className="w-3 h-3" /> {a.action.label}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {m.pending && (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                  <div className="text-[11px] text-amber-200/90 mb-1.5">⚠ {m.pending.summary}</div>
                  <button className="text-[11px] font-bold px-3 py-1.5 rounded bg-amber-500 text-black inline-flex items-center gap-1 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => m.pending && confirmAction(m.pending, i)}>
                    <CheckCircle2 className="w-3 h-3" /> Confirm
                  </button>
                </div>
              )}
              {m.role === 'assistant' && (() => {
                const rows = firstRows(m.data);
                return rows ? (
                  <button
                    onClick={() => printReport(rows, 'KobeOS Report')}
                    className="mt-2 text-[11px] font-semibold px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 inline-flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" /> Print list
                  </button>
                ) : null;
              })()}
            </div>
            {m.role === 'user' && <div className="w-6 h-6 rounded-md bg-white/10 grid place-items-center shrink-0"><User className="w-3.5 h-3.5" /></div>}
          </div>
        ))}
        {!messages.some((m) => m.role === 'user') && !busy && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-white/40 mb-1">Try asking:</p>
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-indigo-500/40 hover:bg-white/[0.06] transition-colors">{s}</button>
            ))}
          </div>
        )}
        {busy && !messages[messages.length - 1]?.content && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500/20 grid place-items-center"><Sparkles className="w-3.5 h-3.5 text-indigo-300" /></div>
            <div className="rounded-2xl px-3 py-2 bg-white/[0.05] border border-white/[0.06] min-w-[170px]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-300" />
                <span className="text-xs text-white/65">{activity?.label || 'Working…'}</span>
              </div>
              {activity?.detail && <div className="mt-1 max-w-[260px] truncate text-[9px] text-white/30">{activity.detail}</div>}
            </div>
          </div>
        )}
      </div>

      <form className="shrink-0 p-3 border-t border-white/[0.06] flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.txt,.md,.csv,.json,.log,.tsv,.html,text/*"
          className="hidden"
          onChange={(e) => { onAttach(e.target.files?.[0]); e.target.value = ''; }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} title="Teach Kobe with a photo, CSV, JSON or document" className="h-10 w-10 grid place-items-center rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/70 hover:text-white disabled:opacity-40"><Paperclip className="w-4 h-4" /></button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? 'Listening…' : 'Ask Kobe, /open an app, or attach data…'} className="flex-1 h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50" />
        {SR && (
          <button type="button" onClick={toggleVoice} title="Speak" className={`h-10 w-10 grid place-items-center rounded-lg ${listening ? 'bg-red-600 animate-pulse text-white' : 'bg-white/[0.05] border border-white/[0.08] text-white/70 hover:text-white'}`}><Mic className="w-4 h-4" /></button>
        )}
        <button type="submit" disabled={busy || !input.trim()} className="h-10 w-10 grid place-items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
