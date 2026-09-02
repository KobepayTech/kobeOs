export type AiTask = 'route' | 'general' | 'reasoning' | 'code' | 'vision' | 'retrieval';

export type AssistantDomain = 'kobepay' | 'properties' | 'hotels' | 'shop' | 'cargo' | 'finance' | 'general';

export interface RouterDecision {
  domain: AssistantDomain;
  task: AiTask;
  toolCalls: Array<{ tool: string; args: Record<string, unknown> }>;
  confidence: number;
  source: 'model' | 'fallback';
}

export interface ModelRoutingConfig {
  everyday: string;
  reasoning: string;
  coder: string;
  vision: string;
  router: string;
}

export const DEFAULT_MODEL_ROUTING: ModelRoutingConfig = {
  everyday: 'qwen2.5:7b',
  reasoning: 'deepseek-r1:8b',
  coder: 'deepseek-coder:6.7b',
  vision: 'qwen2.5vl:7b',
  // Fast-first: use the same warm model for routing and everyday chat so
  // Ollama does not evict/load Phi before Qwen can start answering.
  router: 'qwen2.5:7b',
};

export function detectTask(message: string, hasImages = false): AiTask {
  if (hasImages) return 'vision';
  const q = message.toLowerCase();
  if (/\b(code|typescript|javascript|python|sql|bug|compile|function|class|api endpoint|regex|docker|github|programming)\b/.test(q)) return 'code';
  if (/\b(why|analyse|analyze|compare|strategy|forecast|recommend|reason|root cause|trade[- ]?off|what should|explain how|plan)\b/.test(q) || q.length > 700) return 'reasoning';
  return 'general';
}

export function fallbackDomain(message: string): AssistantDomain {
  const q = ` ${message.toLowerCase()} `;
  const scores: Record<AssistantDomain, number> = {
    kobepay: 0, properties: 0, hotels: 0, shop: 0, cargo: 0, finance: 0, general: 0,
  };
  const add = (domain: AssistantDomain, words: string[]) => {
    for (const word of words) if (q.includes(word)) scores[domain] += word.includes(' ') ? 3 : 1;
  };
  add('kobepay', ['kobepay', 'receipt', 'payment', 'transaction', 'deposit', 'reconcile', 'cashier']);
  add('hotels', ['hotel', 'room', 'guest', 'booking', 'reservation', 'occupancy', 'housekeep', 'check-in', 'checkout']);
  add('properties', ['property', 'properties', 'tenant', 'rent', 'lease', 'landlord', 'apartment', 'arrear', 'eviction']);
  add('cargo', ['cargo', 'parcel', 'shipment', 'freight', 'consignment', 'courier']);
  add('finance', ['finance', 'expense', 'profit', 'cash flow', 'cashflow', 'tax', 'margin', 'accounting', 'balance sheet', 'p&l']);
  add('shop', ['shop', 'sale', 'stock', 'product', 'inventory', 'price', 'sku', 'warehouse', 'catalog']);
  const best = (Object.entries(scores) as Array<[AssistantDomain, number]>)
    .filter(([d]) => d !== 'general')
    .sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'general';
}

export function selectInstalledModel(
  installed: string[],
  requested: string | undefined,
  task: AiTask,
  config: ModelRoutingConfig,
  activeModel: string,
): string {
  const match = (candidate: string) =>
    installed.find((name) => name === candidate)
    ?? installed.find((name) => name.split(':')[0] === candidate.split(':')[0]);

  if (requested) {
    const exact = match(requested);
    if (!exact) throw new Error(`Model ${requested} is not installed. Installed models: ${installed.join(', ')}`);
    return exact;
  }

  const priorities: Record<AiTask, string[]> = {
    // Prefer the already-warm everyday/active model before any tiny fallback.
    // A second model load costs more latency than the tiny router saves.
    route: [config.router, config.everyday, activeModel, 'qwen2.5:3b', 'phi3:mini'],
    general: [config.everyday, 'qwen2.5:7b', activeModel, 'llama3:8b', 'mistral:7b'],
    reasoning: [config.reasoning, 'deepseek-r1:8b', config.everyday, activeModel, 'llama3:8b'],
    code: [config.coder, 'deepseek-coder:6.7b', config.everyday, activeModel],
    vision: [config.vision, 'qwen2.5vl:7b', 'llava:7b', 'moondream:1.8b'],
    retrieval: ['nomic-embed-text'],
  };

  return priorities[task].map(match).find(Boolean) || installed[0];
}

export function parseRouterDecision(text: string): RouterDecision | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as Record<string, unknown>;
    const domains: AssistantDomain[] = ['kobepay', 'properties', 'hotels', 'shop', 'cargo', 'finance', 'general'];
    const routedTasks: AiTask[] = ['general', 'reasoning', 'code', 'vision'];
    const domain = domains.includes(obj.domain as AssistantDomain) ? obj.domain as AssistantDomain : 'general';
    const task = routedTasks.includes(obj.task as AiTask) ? obj.task as AiTask : 'general';
    const rawCalls = Array.isArray(obj.toolCalls) ? obj.toolCalls : [];
    const toolCalls = rawCalls
      .filter((call): call is Record<string, unknown> => !!call && typeof call === 'object' && typeof (call as Record<string, unknown>).tool === 'string')
      .slice(0, 4)
      .map((call) => ({
        tool: String(call.tool),
        args: call.args && typeof call.args === 'object' && !Array.isArray(call.args)
          ? call.args as Record<string, unknown>
          : {},
      }));
    const confidence = Math.max(0, Math.min(1, Number(obj.confidence ?? 0.7) || 0.7));
    return { domain, task, toolCalls, confidence, source: 'model' };
  } catch {
    return null;
  }
}
