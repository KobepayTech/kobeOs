import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart3, RefreshCw, Loader2, TrendingDown, Wallet, Users, Package } from 'lucide-react';

/**
 * Owner-facing discount report — totals, by-seller, by-product, margin
 * impact. Drives off /discount-approval/reports which aggregates DiscountLog
 * rows. Default range is the current calendar month; date inputs let the
 * owner pick a custom window.
 */
interface ReportShape {
  period: { from: string; to: string };
  totals: {
    approvedRequests: number;
    standardValue: number;
    actualValue: number;
    discountAmount: number;
    discountRate: number;
    profit: number;
    potentialProfit: number;
    profitLostPct: number;
  };
  bySeller: Array<{ sellerId: string; discountAmount: number; actualValue: number; requests: number; discountRate: number }>;
  byProduct: Array<{ productId: string; discountAmount: number; actualValue: number; quantity: number; avgDiscountPercent: number }>;
}

const fmt = (n: number) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const pct = (n: number) => (Number(n) || 0).toFixed(1) + '%';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DiscountReports() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(isoDate(firstOfMonth));
  const [to, setTo] = useState(isoDate(today));
  const [report, setReport] = useState<ReportShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to }).toString();
      const r = await api<ReportShape>(`/discount-approval/reports?${params}`);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const profitLost = report?.totals.profitLostPct ?? 0;
  const healthy = profitLost < 10;

  const sellersMax = useMemo(() => Math.max(1, ...(report?.bySeller ?? []).map((s) => s.discountAmount)), [report]);

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Discount report</h2>
            <p className="text-[11px] text-white/40">Totals, by seller, by product. Defaults to this month.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white/5 border-white/10 h-8 w-36" />
          <span className="text-white/40">→</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white/5 border-white/10 h-8 w-36" />
          <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-8">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading report…
        </div>
      )}
      {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">{error}</div>}

      {!loading && report && (
        <>
          {/* ── Headline totals ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={<TrendingDown className="w-4 h-4 text-rose-300" />}
              label="Total discounts"
              value={fmt(report.totals.discountAmount)}
              hint={`${pct(report.totals.discountRate)} of standard value`}
            />
            <KpiCard
              icon={<Wallet className="w-4 h-4 text-emerald-300" />}
              label="Actual profit"
              value={fmt(report.totals.profit)}
              hint={`vs potential ${fmt(report.totals.potentialProfit)}`}
            />
            <KpiCard
              icon={<BarChart3 className="w-4 h-4 text-amber-300" />}
              label="Approved sales"
              value={String(report.totals.approvedRequests)}
              hint={`worth ${fmt(report.totals.actualValue)}`}
            />
            <KpiCard
              icon={<TrendingDown className={`w-4 h-4 ${healthy ? 'text-emerald-300' : 'text-rose-300'}`} />}
              label="Profit lost to discounts"
              value={pct(profitLost)}
              hint={healthy ? 'Within healthy band' : 'Above 10% — review pricing'}
            />
          </div>

          {/* ── By seller ── */}
          <Card className="bg-[#13131f] border-white/10">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="w-4 h-4 text-amber-300" /> By seller
              </div>
              {report.bySeller.length === 0 ? (
                <p className="text-xs text-white/40 py-2">No approved discounts in this window.</p>
              ) : (
                <div className="space-y-2">
                  {report.bySeller.map((s) => (
                    <div key={s.sellerId}>
                      <div className="flex justify-between text-xs">
                        <span className="font-mono text-white/70">{s.sellerId.slice(0, 8)}</span>
                        <span className="text-white">
                          {fmt(s.discountAmount)} <span className="text-white/40">· {s.requests} sales · {pct(s.discountRate)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                        <div
                          className="h-full bg-amber-500/70"
                          style={{ width: `${(s.discountAmount / sellersMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── By product ── */}
          <Card className="bg-[#13131f] border-white/10">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="w-4 h-4 text-amber-300" /> Top discounted products
              </div>
              {report.byProduct.length === 0 ? (
                <p className="text-xs text-white/40 py-2">Nothing to show yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-white/40 text-[10px] uppercase">
                    <tr><th className="text-left py-1">Product</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Avg disc.</th><th className="text-right py-1">Discount $</th></tr>
                  </thead>
                  <tbody>
                    {report.byProduct.map((p) => (
                      <tr key={p.productId} className="border-t border-white/[0.04]">
                        <td className="py-1 font-mono text-white/80">{p.productId.slice(0, 8)}</td>
                        <td className="py-1 text-right">{p.quantity}</td>
                        <td className="py-1 text-right">{pct(p.avgDiscountPercent)}</td>
                        <td className="py-1 text-right font-medium">{fmt(p.discountAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card className="bg-[#13131f] border-white/10">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase text-white/40 tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="text-xl font-bold text-white">{value}</div>
        <p className="text-[10px] text-white/40">{hint}</p>
      </CardContent>
    </Card>
  );
}
