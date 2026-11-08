export const OWNER_REPORTS = {
  'shop-close': {
    name: 'Owner’s shop close',
    objective: 'Review completed sales by payment method, recorded expenses, and the latest till count for each shop.',
    timeOfDay: '19:30',
    modules: ['erp', 'payments', 'reports'],
  },
  'stock-watch': {
    name: 'Stock and reorder watch',
    objective: 'Flag low POS stock and warehouse items at their recorded reorder levels.',
    timeOfDay: '08:00',
    modules: ['inventory', 'erp'],
  },
  'margin-watch': {
    name: 'Price and margin watch',
    objective: 'Spot products priced below recorded unit cost, below 15% estimated gross margin, or missing cost information.',
    timeOfDay: '09:00',
    modules: ['erp', 'inventory'],
  },
  'incoming-watch': {
    name: 'Incoming order watch',
    objective: 'Flag overdue orders, expected arrivals in the next seven days, and orders missing an ETA.',
    timeOfDay: '09:30',
    modules: ['erp', 'inventory'],
  },
} as const;

export type OwnerReportKey = keyof typeof OWNER_REPORTS;
export const OWNER_REPORT_KEYS = Object.keys(OWNER_REPORTS) as OwnerReportKey[];
