import { useEffect, useState } from 'react';

export const KDS_STAGES = [
  { status: 'NEW', title: 'New', color: 'text-sky-600 dark:text-sky-300', action: 'start', label: 'Start preparing' },
  { status: 'PREPARING', title: 'Preparing', color: 'text-amber-600 dark:text-amber-300', action: 'ready', label: 'Mark ready' },
  { status: 'READY', title: 'Ready', color: 'text-emerald-700 dark:text-emerald-300', action: 'collected', label: 'Confirm handover' },
] as const;

export type KdsAction = typeof KDS_STAGES[number]['action'];
export interface KdsTicket {
  id: string;
  orderNumber: string;
  createdAt: string;
  readyAt?: string | null;
  fulfillmentStatus: typeof KDS_STAGES[number]['status'];
  fulfillmentMethod?: 'PICKUP' | 'DELIVERY' | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number | string;
    unit?: string;
    sku?: string;
    shelf?: string | null;
    color?: string;
    size?: string;
    variantUnspecified?: boolean;
  }>;
}

export function KdsBoard({ rows, error, lastSynced, busy, onAction }: {
  rows: KdsTicket[] | null;
  error: string;
  lastSynced: number | null;
  busy?: string;
  onAction?: (ticket: KdsTicket, action: KdsAction) => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="space-y-4">
      <p role="status" className={error ? 'text-amber-500' : 'text-slate-500'}>
        {error || (lastSynced ? 'Queue up to date' : 'Syncing orders…')}
        {error && lastSynced && ` Last synced ${new Date(lastSynced).toLocaleTimeString()}`}
      </p>
      {rows && <div className="grid gap-4 md:grid-cols-3">
        {KDS_STAGES.map(stage => {
          const tickets = rows.filter(ticket => ticket.fulfillmentStatus === stage.status)
            .sort((first, second) => {
              const time = (ticket: KdsTicket) => Date.parse(stage.status === 'READY' ? ticket.readyAt ?? ticket.createdAt : ticket.createdAt);
              return time(first) - time(second);
            });
          return <section className="min-w-0 rounded-xl border border-slate-500/30 p-3" key={stage.status}>
            <h2 className={`mb-3 text-lg font-bold ${stage.color}`}>{stage.title} <span className="text-sm tabular-nums opacity-70">{tickets.length}</span></h2>
            {tickets.length === 0 && <p className="text-sm opacity-70">No orders</p>}
            <ul className="space-y-3">
              {tickets.map(ticket => {
                const since = stage.status === 'READY' ? ticket.readyAt ?? ticket.createdAt : ticket.createdAt;
                const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60000));
                const overdue = minutes >= 10;
                return <li key={ticket.id} className="space-y-2 rounded-lg border border-slate-500/30 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="text-xl font-bold">#{ticket.orderNumber}</span>
                    <span className={overdue ? 'font-semibold text-amber-600' : 'opacity-70'}>{minutes} min{overdue ? ' waiting' : ''}</span>
                  </div>
                  {ticket.fulfillmentMethod && <p className="text-sm capitalize opacity-70">{ticket.fulfillmentMethod.toLowerCase()}</p>}
                  <ul className="space-y-2">
                    {ticket.items.map(item => <li key={item.id}>
                      <p className="break-words"><strong>{Number(item.quantity)}{item.unit && !['piece', 'pcs'].includes(item.unit) ? ` ${item.unit}` : ' ×'}</strong> {item.productName}</p>
                      <p className="break-words text-sm opacity-70">{[item.sku, item.color, item.size, item.shelf].filter(Boolean).join(' · ')}</p>
                      {item.variantUnspecified && <p className="text-sm font-medium text-amber-600">Confirm size and color</p>}
                    </li>)}
                  </ul>
                  {onAction && <button className="min-h-10 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={!!busy || !!error} onClick={() => onAction(ticket, stage.action)}>
                    {busy === ticket.id ? 'Saving…' : stage.label}
                  </button>}
                </li>;
              })}
            </ul>
          </section>;
        })}
      </div>}
    </div>
  );
}
