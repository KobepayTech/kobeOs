import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Printer, RefreshCw, ArrowRight, Package, XCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

type PickTicketStatus = 'PENDING' | 'PICKING' | 'PACKED' | 'DISPATCHED' | 'CANCELLED';

interface PickTicketListRow {
  id: string;
  ticketNumber: string;
  orderId: string | null;
  warehouseId: string | null;
  customerName: string | null;
  status: PickTicketStatus;
  pickedBy: string | null;
  createdAt: string;
}

interface PickTicketItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  location: string | null;
  picked: boolean;
}

interface PickTicketDetail extends PickTicketListRow {
  items: PickTicketItem[];
}

const STATUS_TABS: PickTicketStatus[] = ['PENDING', 'PICKING', 'PACKED', 'DISPATCHED'];

const STATUS_STYLE: Record<PickTicketStatus, string> = {
  PENDING:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  PICKING:    'bg-sky-500/15 text-sky-300 border-sky-500/30',
  PACKED:     'bg-violet-500/15 text-violet-300 border-violet-500/30',
  DISPATCHED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CANCELLED:  'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const NEXT_STATUS: Partial<Record<PickTicketStatus, PickTicketStatus>> = {
  PENDING: 'PICKING',
  PICKING: 'PACKED',
  PACKED: 'DISPATCHED',
};

const NEXT_LABEL: Partial<Record<PickTicketStatus, string>> = {
  PENDING: 'Start picking',
  PICKING: 'Mark packed',
  PACKED: 'Dispatch',
};

export default function WarehouseOpsApp() {
  const [tickets, setTickets] = useState<PickTicketListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<PickTicketStatus>('PENDING');
  const [openTicket, setOpenTicket] = useState<PickTicketDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await api<PickTicketListRow[]>('/warehouse/pick-tickets');
      setTickets(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { (async () => { await ensureSession(); await reload(); })(); }, [reload]);

  const counts = useMemo(() => {
    const c: Record<PickTicketStatus, number> = { PENDING: 0, PICKING: 0, PACKED: 0, DISPATCHED: 0, CANCELLED: 0 };
    for (const t of tickets) c[t.status]++;
    return c;
  }, [tickets]);

  const filtered = useMemo(() => tickets.filter((t) => t.status === active), [tickets, active]);

  const openDetail = useCallback(async (id: string) => {
    try {
      const detail = await api<PickTicketDetail>(`/warehouse/pick-tickets/${id}`);
      setOpenTicket(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const advance = useCallback(async (ticket: PickTicketDetail | PickTicketListRow, target: PickTicketStatus) => {
    setBusy(true);
    try {
      const updated = await api<PickTicketListRow>(`/warehouse/pick-tickets/${ticket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: target }),
      });
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      if (openTicket?.id === ticket.id) {
        const refreshed = await api<PickTicketDetail>(`/warehouse/pick-tickets/${ticket.id}`);
        setOpenTicket(refreshed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [openTicket]);

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-emerald-400" />
          <div>
            <h1 className="text-base font-semibold">Warehouse Ops</h1>
            <p className="text-xs text-slate-400">Pick → Pack → Dispatch</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            <span className="ml-1.5 text-xs">Refresh</span>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-3 px-5 py-3">
        {STATUS_TABS.map((s) => (
          <Card key={s} className="border-slate-800 bg-slate-900/60">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase tracking-wide text-slate-400">{s}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-100">{counts[s]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={active} onValueChange={(v) => setActive(v as PickTicketStatus)} className="flex flex-1 flex-col px-5 pb-5">
        <TabsList className="bg-slate-900/60">
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s} value={s}>{s} ({counts[s]})</TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((s) => (
          <TabsContent key={s} value={s} className="mt-3 flex-1">
            {error && (
              <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-500">
                <Package className="mb-2 h-10 w-10 opacity-50" />
                <p className="text-sm">No tickets in {s.toLowerCase()}.</p>
              </div>
            ) : (
              <ScrollArea className="h-[420px]">
                <div className="flex flex-col gap-2">
                  {filtered.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-slate-700"
                    >
                      <button onClick={() => openDetail(t.id)} className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-slate-100">{t.ticketNumber}</span>
                          <Badge variant="outline" className={STATUS_STYLE[t.status]}>{t.status}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {t.customerName ?? 'Walk-in'} · created {new Date(t.createdAt).toLocaleString()}
                          {t.pickedBy ? ` · picker ${t.pickedBy}` : ''}
                        </div>
                      </button>
                      {NEXT_STATUS[t.status] && (
                        <Button size="sm" disabled={busy} onClick={() => advance(t, NEXT_STATUS[t.status] as PickTicketStatus)}>
                          {NEXT_LABEL[t.status]} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!openTicket} onOpenChange={(o) => !o && setOpenTicket(null)}>
        <DialogContent className="max-w-lg border-slate-800 bg-slate-950 text-slate-100">
          {openTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="font-mono">{openTicket.ticketNumber}</span>
                  <Badge variant="outline" className={STATUS_STYLE[openTicket.status]}>{openTicket.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <ReceiptView ticket={openTicket} />
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => printReceipt(openTicket)}>
                  <Printer className="mr-1.5 h-4 w-4" /> Print
                </Button>
                {openTicket.status !== 'CANCELLED' && openTicket.status !== 'DISPATCHED' && (
                  <Button variant="destructive" size="sm" disabled={busy} onClick={() => advance(openTicket, 'CANCELLED')}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Cancel
                  </Button>
                )}
                {NEXT_STATUS[openTicket.status] && (
                  <Button size="sm" disabled={busy} onClick={() => advance(openTicket, NEXT_STATUS[openTicket.status] as PickTicketStatus)}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    {NEXT_LABEL[openTicket.status]}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceiptView({ ticket }: { ticket: PickTicketDetail }) {
  return (
    <div id="kobe-pick-ticket-receipt" className="rounded-md border border-slate-800 bg-slate-900/60 p-4 font-mono text-xs leading-relaxed text-slate-200">
      <div className="text-center text-sm font-semibold">KobeOS Warehouse Pick Ticket</div>
      <div className="my-2 border-t border-slate-700" />
      <div>Ticket : {ticket.ticketNumber}</div>
      <div>Status : {ticket.status}</div>
      <div>Customer: {ticket.customerName ?? 'Walk-in'}</div>
      <div>Created: {new Date(ticket.createdAt).toLocaleString()}</div>
      {ticket.pickedBy && <div>Picker : {ticket.pickedBy}</div>}
      <div className="my-2 border-t border-slate-700" />
      <table className="w-full text-left">
        <thead>
          <tr className="text-slate-400">
            <th className="pb-1">SKU</th>
            <th className="pb-1">Item</th>
            <th className="pb-1">Bin</th>
            <th className="pb-1 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {ticket.items.map((it) => (
            <tr key={it.id} className="border-t border-slate-800/60">
              <td className="py-1">{it.sku}</td>
              <td>{it.name}</td>
              <td>{it.location ?? '—'}</td>
              <td className="text-right">{it.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function printReceipt(ticket: PickTicketDetail) {
  const html = document.getElementById('kobe-pick-ticket-receipt')?.outerHTML ?? '';
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${ticket.ticketNumber}</title>
    <style>body{font-family:ui-monospace,monospace;color:#000;background:#fff;padding:12px;font-size:11px}
    table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:2px 4px}
    th{border-bottom:1px solid #000}tr+tr td{border-top:1px solid #ddd}</style></head>
    <body>${html}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}
