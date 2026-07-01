import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useQRScanner } from '@/hooks/useQRScanner';
import {
  Loader2, QrCode, PackageCheck, Truck, ClipboardCheck,
  ChevronRight, ArrowLeft, X, CheckCircle2, AlertTriangle,
  Clock, Box, Search, ScanLine,
} from 'lucide-react';

/**
 * MobileDispatch — Warehouse dispatch with QR-code progress tracking.
 *
 * A warehouse worker scans a QR code on an order/package to view it,
 * then walks it through the fulfillment pipeline:
 *   PENDING → PICKED → PACKED → DISPATCHED
 *
 * Each status change is confirmed by scanning the order QR again,
 * preventing accidental mis-clicks and creating an audit trail of
 * who handled the package and when.
 *
 * Connected to /pos/orders (reads) and PATCH /pos/orders/:id/status
 * (writes) so dispatch data flows back to the desktop KobeOS.
 */

// ── Types ────────────────────────────────────────────────────────────────────

type DispatchStatus = 'PENDING' | 'PICKED' | 'PACKED' | 'DISPATCHED';

interface OrderLine {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit?: string;
  picked?: boolean;
}

interface DispatchOrder {
  id: string;
  orderNumber: string;
  status: DispatchStatus;
  customerName?: string | null;
  deliveryAddress?: string | null;
  phone?: string | null;
  total: number | string;
  paymentMethod?: string;
  createdAt?: string;
  updatedAt?: string;
  lines: OrderLine[];
  qrCode?: string;  // The value encoded in the order's QR sticker
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_FLOW: DispatchStatus[] = ['PENDING', 'PICKED', 'PACKED', 'DISPATCHED'];

const STATUS_META: Record<DispatchStatus, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  PENDING:    { label: 'Pending',    color: 'text-amber-700',    bg: 'bg-amber-50',    border: 'border-amber-200',    icon: Clock },
  PICKED:     { label: 'Picked',     color: 'text-blue-700',     bg: 'bg-blue-50',     border: 'border-blue-200',     icon: Box },
  PACKED:     { label: 'Packed',     color: 'text-indigo-700',   bg: 'bg-indigo-50',   border: 'border-indigo-200',   icon: PackageCheck },
  DISPATCHED: { label: 'Dispatched', color: 'text-emerald-700',  bg: 'bg-emerald-50',  border: 'border-emerald-200',  icon: Truck },
};

const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;
const fmtDate = (d?: string) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

// ── Main Component ───────────────────────────────────────────────────────────

type ViewMode = 'list' | 'scan' | 'detail' | 'scan-confirm';

export default function MobileDispatch() {
  const { slug } = useParams<{ slug: string }>();
  const [view, setView] = useState<ViewMode>('list');
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [nextStatus, setNextStatus] = useState<DispatchStatus | null>(null);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DispatchStatus | 'ALL'>('ALL');

  // QR scanner
  const { videoRef, result, scanning, error: scanError, start: startScan, stop: stopScan } = useQRScanner();

  // ── Load orders ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await api<DispatchOrder[]>('/pos/orders?limit=200');
        if (!cancelled) setOrders(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Handle QR scan result ──────────────────────────────────────────────────
  useEffect(() => {
    if (!result) return;

    // Try to match scanned value against orderNumber or order.id
    const matched = orders.find(
      (o) => o.orderNumber === result.rawValue || o.id === result.rawValue || o.qrCode === result.rawValue,
    );

    if (matched) {
      setSelectedOrder(matched);
      if (view === 'scan-confirm' && nextStatus) {
        // Scan-confirm flow: QR matched, proceed with status update
        doStatusUpdate(matched, nextStatus);
      } else {
        setView('detail');
      }
    } else {
      setToast(`No order found for "${result.rawValue}"`);
      setTimeout(() => setToast(null), 3000);
    }
  }, [result]);

  // ── Filtered orders ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let base = orders;
    if (statusFilter !== 'ALL') {
      base = base.filter((o) => o.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customerName ?? '').toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q),
    );
  }, [orders, statusFilter, search]);

  // ── Status counts ──────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: orders.length };
    for (const s of STATUS_FLOW) c[s] = orders.filter((o) => o.status === s).length;
    return c;
  }, [orders]);

  // ── Update order status ────────────────────────────────────────────────────
  const doStatusUpdate = async (order: DispatchOrder, newStatus: DispatchStatus) => {
    setUpdating(true);
    setErr(null);
    try {
      await api(`/pos/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      // Optimistically update local state
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: newStatus, updatedAt: new Date().toISOString() } : o)),
      );
      setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus, updatedAt: new Date().toISOString() } : prev));

      setToast(`${order.orderNumber} → ${STATUS_META[newStatus].label}`);
      setTimeout(() => setToast(null), 3000);

      setView('detail');
      setNextStatus(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const requestStatusUpdate = (newStatus: DispatchStatus) => {
    setNextStatus(newStatus);
    setView('scan-confirm');
    startScan();
  };

  // ── Render views ───────────────────────────────────────────────────────────

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 sticky top-0 bg-slate-50 z-10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Dispatch</h2>
            <button
              onClick={() => { setView('scan'); startScan(); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold active:bg-indigo-700"
            >
              <QrCode className="w-4 h-4" /> Scan QR
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order # or customer…"
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {(['ALL', ...STATUS_FLOW] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {s === 'ALL' ? 'All' : STATUS_META[s].label} ({counts[s] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          {loading ? (
            <div className="grid place-items-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : err ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 text-xs">{err}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <PackageCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-400">{statusFilter === 'ALL' ? 'No orders yet.' : `No ${STATUS_META[statusFilter].label.toLowerCase()} orders.`}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((o) => {
                const meta = STATUS_META[o.status];
                const Icon = meta.icon;
                return (
                  <li key={o.id}>
                    <button
                      onClick={() => { setSelectedOrder(o); setView('detail'); }}
                      className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl text-left active:bg-slate-50"
                    >
                      <div className={`w-10 h-10 rounded-lg grid place-items-center ${meta.bg} ${meta.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{o.orderNumber}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${meta.bg} ${meta.color} ${meta.border}`}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {o.customerName || 'Walk-in'} · {fmt(parseFloat(String(o.total)))} · {fmtDate(o.createdAt)}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed top-16 left-4 right-4 z-30 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 p-3 flex items-center gap-2 shadow-lg text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 shrink-0" />{toast}
          </div>
        )}
      </div>
    );
  }

  // ── SCAN VIEW ── (standalone QR scanner)
  if (view === 'scan') {
    return (
      <div className="flex flex-col h-full bg-black">
        {/* Header overlay */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/80">
          <button
            onClick={() => { stopScan(); setView('list'); }}
            className="inline-flex items-center gap-1 text-white text-sm font-bold"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <span className="text-white text-xs font-bold">Scan order QR</span>
          <div className="w-16" />
        </div>

        {/* Camera viewfinder */}
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Scan frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 border-2 border-white/60 rounded-2xl relative">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
            </div>
          </div>
          {scanning && (
            <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 text-white text-xs font-bold">
                <ScanLine className="w-4 h-4 animate-pulse" /> Point camera at order QR code
              </span>
            </div>
          )}
        </div>

        {scanError && (
          <div className="shrink-0 p-4 bg-rose-950 text-rose-300 text-xs text-center">
            <AlertTriangle className="w-4 h-4 inline mr-1" />{scanError}
          </div>
        )}
      </div>
    );
  }

  // ── SCAN-CONFIRM VIEW ── (QR confirmation before status change)
  if (view === 'scan-confirm' && selectedOrder && nextStatus) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/80">
          <button
            onClick={() => { stopScan(); setView('detail'); setNextStatus(null); }}
            className="inline-flex items-center gap-1 text-white text-sm font-bold"
          >
            <ArrowLeft className="w-5 h-5" /> Cancel
          </button>
          <span className="text-white text-xs font-bold">Confirm: Scan order QR</span>
          <div className="w-16" />
        </div>

        <div className="shrink-0 px-4 py-3 bg-indigo-950/80 text-center">
          <p className="text-indigo-200 text-xs">
            Updating <strong className="text-white">{selectedOrder.orderNumber}</strong> to{' '}
            <strong className="text-white">{STATUS_META[nextStatus].label}</strong>
          </p>
          <p className="text-indigo-400 text-[10px] mt-0.5">Scan the order QR sticker to confirm</p>
        </div>

        <div className="flex-1 relative">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 border-2 border-indigo-400/60 rounded-2xl relative">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
            </div>
          </div>
          {updating && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-sm font-bold text-slate-900">Updating…</span>
              </div>
            </div>
          )}
        </div>

        {scanError && (
          <div className="shrink-0 p-4 bg-rose-950 text-rose-300 text-xs text-center">
            <AlertTriangle className="w-4 h-4 inline mr-1" />{scanError}
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ──
  const order = selectedOrder;
  if (!order) return null;

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const canAdvance = currentIdx < STATUS_FLOW.length - 1;
  const next = canAdvance ? STATUS_FLOW[currentIdx + 1] : null;

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 bg-slate-50 border-b border-slate-200">
        <button
          onClick={() => setView('list')}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> All orders
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">{order.orderNumber}</h2>
            <p className="text-[10px] text-slate-500">{fmtDate(order.createdAt)} · {order.id.slice(0, 8)}</p>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_META[order.status].bg} ${STATUS_META[order.status].color} ${STATUS_META[order.status].border}`}>
            {STATUS_META[order.status].label}
          </span>
        </div>
      </div>

      {/* Progress pipeline */}
      <div className="shrink-0 px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          {STATUS_FLOW.map((s, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-extrabold border-2 ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : done
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    {done ? (active ? i + 1 : <CheckCircle2 className="w-4 h-4" />) : i + 1}
                  </div>
                  <span className={`text-[9px] font-bold ${active ? 'text-indigo-700' : done ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {STATUS_META[s].label}
                  </span>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded-full ${i < currentIdx ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Order details */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Customer */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wide">Customer</h3>
          <div className="text-sm font-bold text-slate-900">{order.customerName || 'Walk-in customer'}</div>
          {order.phone && <div className="text-xs text-slate-500">{order.phone}</div>}
          {order.deliveryAddress && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mt-1">{order.deliveryAddress}</div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wide">Items</h3>
          {order.lines?.length ? (
            <ul className="space-y-2">
              {order.lines.map((l, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center text-[10px] font-bold text-slate-500">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{l.productName}</div>
                    <div className="text-[10px] text-slate-500">{l.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">×{l.quantity}{l.unit ? ` ${l.unit}` : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">No item details available.</p>
          )}
          <div className="border-t border-slate-100 pt-2 flex justify-between">
            <span className="text-xs font-bold text-slate-500">Total</span>
            <span className="text-base font-extrabold text-slate-900">{fmt(parseFloat(String(order.total)))}</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Payment</span>
            <span className="font-bold">{order.paymentMethod || 'CASH'}</span>
          </div>
        </div>

        {/* QR Code value */}
        {order.qrCode && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <QrCode className="w-5 h-5 text-slate-400" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-500">QR Code</div>
              <div className="text-xs font-mono text-slate-900 truncate">{order.qrCode}</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="shrink-0 px-4 py-3 bg-white border-t border-slate-200">
        {canAdvance && next ? (
          <button
            onClick={() => requestStatusUpdate(next)}
            disabled={updating}
            className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            {updating ? 'Updating…' : `Mark as ${STATUS_META[next].label} (Scan QR)`}
          </button>
        ) : (
          <div className="w-full h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-sm inline-flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Fully dispatched
          </div>
        )}
      </div>

      {/* Error toast */}
      {err && (
        <div className="absolute top-4 left-4 right-4 z-30 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 p-3 flex items-center gap-2 shadow-lg text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />{err}
          <button onClick={() => setErr(null)} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}
      {toast && (
        <div className="absolute top-4 left-4 right-4 z-30 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 p-3 flex items-center gap-2 shadow-lg text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 shrink-0" />{toast}
        </div>
      )}
    </div>
  );
}
