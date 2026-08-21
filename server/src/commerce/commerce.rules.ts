export const LITE_FREE_ORDER_LIMIT = 50;
export const NODE_STALE_MINUTES = 3;

export function normalizePhone(value: string): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('255')) return `+${digits}`;
  if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
  return digits ? `+${digits}` : '';
}

export function shopCode(propertyName: string, floorCode: string, sequence: number): string {
  const prefix = propertyName.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const floor = floorCode.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'G';
  return `${prefix}-${floor}-${String(sequence).padStart(2, '0')}`;
}

export function isNodeOnline(lastSeenAt: Date | null | undefined, now = new Date()): boolean {
  return Boolean(lastSeenAt && now.getTime() - lastSeenAt.getTime() <= NODE_STALE_MINUTES * 60_000);
}

export function merchantOrderAccess(tier: 'LITE' | 'FULL', priorOrders: number, limit = LITE_FREE_ORDER_LIMIT) {
  const locked = tier === 'LITE' && priorOrders >= limit;
  return { locked, status: locked ? 'WAITING_ACTIVATION' as const : 'SUBMITTED' as const, orderNumber: priorOrders + 1 };
}

export function missingRequiredOptions(required: string[], selected: Record<string, string> | undefined): string[] {
  return required.filter((option) => !selected?.[option]?.trim());
}

export function groupByMerchant<T>(lines: T[], businessIdFor: (line: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const businessId = businessIdFor(line);
    groups.set(businessId, [...(groups.get(businessId) ?? []), line]);
  }
  return groups;
}

export function isVehiclePublic(status: string): boolean {
  return ['AVAILABLE', 'IN_TRANSIT', 'COMING_SOON'].includes(status);
}

export function vehicleEconomics(costs: { purchaseCost?: number; dutyCost?: number; clearingCost?: number; transportCost?: number; repairCost?: number; advertisingCost?: number }, sellingPrice: number) {
  const landedCost = ['purchaseCost', 'dutyCost', 'clearingCost', 'transportCost', 'repairCost', 'advertisingCost']
    .reduce((total, key) => total + Math.max(0, Number(costs[key as keyof typeof costs]) || 0), 0);
  return { landedCost, projectedMargin: Number(sellingPrice) - landedCost };
}

export function extractCaptionProductMetadata(caption = '') {
  const text = caption.trim();
  const lower = text.toLowerCase();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const priceMatch = text.match(/(?:jumla|retail|wholesale|bei|price|tzs|tsh)?\s*[:=-]?\s*(\d{1,3}(?:[,.]\d{3})+|\d{4,})/i);
  const sizeMatch = text.match(/sizes?\s*[:=-]?\s*(\d+)\s*(?:-|–|to)\s*(\d+)/i);
  const explicitSizes = text.match(/sizes?\s*[:=-]?\s*([a-z0-9, /-]+)/i)?.[1]?.split(/[,/ ]+/).filter(Boolean) ?? [];
  let sizes = explicitSizes;
  if (sizeMatch) {
    const from = Number(sizeMatch[1]); const to = Number(sizeMatch[2]);
    if (to >= from && to - from <= 20) sizes = Array.from({ length: to - from + 1 }, (_, index) => String(from + index));
  }
  const colorMatch = text.match(/colou?rs?\s*[:=-]?\s*([a-z ,/]+)/i);
  const colors = colorMatch?.[1]?.split(/[,/]+/).map((value) => value.trim()).filter(Boolean) ?? [];
  const category = /jean|shirt|dress|shoe|bag|fashion|clothing/.test(lower) ? 'Fashion'
    : /phone|computer|tv|audio|electronic/.test(lower) ? 'Electronics'
      : /food|meal|rice|chicken|drink/.test(lower) ? 'Food' : '';
  const styles = ['damage', 'kacha', 'retro', 'training', 'official'].filter((style) => lower.includes(style));
  return {
    title: lines[0]?.replace(/\b(?:tzs|tsh)\b.*$/i, '').trim() || '',
    price: priceMatch ? Number(priceMatch[1].replace(/[,.]/g, '')) : 0,
    category,
    sizes: [...new Set(sizes.map((size) => size.toUpperCase()))],
    colors: [...new Set(colors.map((color) => color.replace(/\b(?:size|price|jumla).*$/i, '').trim()).filter(Boolean))],
    styles,
    priceType: /jumla|wholesale/.test(lower) ? 'WHOLESALE' : /retail/.test(lower) ? 'RETAIL' : '',
  };
}

export function panelCrops(panelCount: number): Array<{ left: number; top: number; width: number; height: number }> {
  const count = Math.min(12, Math.max(1, Math.floor(panelCount)));
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => ({
    left: (index % columns) / columns,
    top: Math.floor(index / columns) / rows,
    width: 1 / columns,
    height: 1 / rows,
  }));
}
