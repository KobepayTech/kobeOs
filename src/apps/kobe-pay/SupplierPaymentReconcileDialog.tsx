import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Package, Wallet, Check, Plus, Trash2 } from 'lucide-react';

/**
 * Reconciliation prompt that opens after a KobePay payout matches an
 * ERP supplier by phone. Asks the operator:
 *
 *   "You just sent TZS X to Mama Rose. What was this for?"
 *     - Payment toward an existing PO (pick from open POs)
 *     - New goods just delivered (list quantity + items)
 *     - General supplier payment / prepayment
 *
 * Records the chosen reconciliation against /erp/sourcing/supplier-
 * payments and closes. The KobePay payout itself is already saved —
 * this just adds the accounting layer on top so AP and outstanding
 * PO balances stay accurate.
 */
export interface ReconcileErpMatch {
  supplierId: string;
  supplierName: string;
  openPos: Array<{
    id: string;
    poNumber: string;
    total: number;
    paidAmount: number;
    outstanding: number;
    status: string;
  }>;
}

interface NewGoodsLine { description: string; quantity: number; unitPrice: number }

const fmtMoney = (n: number, currency: string) =>
  `${currency} ${Math.round(n).toLocaleString()}`;

export function SupplierPaymentReconcileDialog({
  payoutId, amount, currency, erpMatch, onClose,
}: {
  payoutId: string;
  amount: number;
  currency: string;
  erpMatch: ReconcileErpMatch;
  onClose: () => void;
}) {
  // Default the operator to the most useful screen: pick-a-PO when one
  // exists, NEW_GOODS otherwise.
  const [kind, setKind] = useState<'PO_PAYMENT' | 'NEW_GOODS' | 'GENERAL'>(
    erpMatch.openPos.length > 0 ? 'PO_PAYMENT' : 'NEW_GOODS',
  );
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>(
    erpMatch.openPos[0]?.id ?? '',
  );
  const [newGoods, setNewGoods] = useState<NewGoodsLine[]>([
    { description: '', quantity: 1, unitPrice: amount },
  ]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPo = erpMatch.openPos.find((p) => p.id === purchaseOrderId);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api('/erp/sourcing/supplier-payments', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: erpMatch.supplierId,
          amount,
          currency,
          kind,
          purchaseOrderId: kind === 'PO_PAYMENT' ? purchaseOrderId : undefined,
          payoutId,
          itemsSnapshot: kind === 'NEW_GOODS'
            ? newGoods.filter((l) => l.description.trim()).map((l) => ({
                description: l.description.trim(),
                quantity: Number(l.quantity) || 1,
                unitPrice: Number(l.unitPrice) || 0,
              }))
            : undefined,
          notes,
        }),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <header className="p-5 border-b border-slate-100">
          <div className="text-xs text-slate-500 mb-1">Payment recorded</div>
          <h2 className="text-lg font-extrabold text-slate-900">
            You just sent {fmtMoney(amount, currency)} to {erpMatch.supplierName}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            What was this payment for? Linking it now keeps your accounts payable + PO outstanding accurate.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Three big choice cards */}
          <div className="grid grid-cols-3 gap-2">
            <KindCard
              active={kind === 'PO_PAYMENT'}
              disabled={erpMatch.openPos.length === 0}
              onClick={() => setKind('PO_PAYMENT')}
              icon={<FileText className="w-5 h-5" />}
              label="Pay PO"
              subtitle={erpMatch.openPos.length > 0
                ? `${erpMatch.openPos.length} open`
                : 'No open POs'}
            />
            <KindCard
              active={kind === 'NEW_GOODS'}
              onClick={() => setKind('NEW_GOODS')}
              icon={<Package className="w-5 h-5" />}
              label="New goods"
              subtitle="Bought directly"
            />
            <KindCard
              active={kind === 'GENERAL'}
              onClick={() => setKind('GENERAL')}
              icon={<Wallet className="w-5 h-5" />}
              label="General"
              subtitle="Deposit / other"
            />
          </div>

          {kind === 'PO_PAYMENT' && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">Which PO does this pay down?</div>
              {erpMatch.openPos.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No open POs for {erpMatch.supplierName}.</div>
              ) : (
                <div className="space-y-1.5">
                  {erpMatch.openPos.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                        purchaseOrderId === p.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="po"
                        checked={purchaseOrderId === p.id}
                        onChange={() => setPurchaseOrderId(p.id)}
                        className="accent-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900">{p.poNumber}</div>
                        <div className="text-[10px] text-slate-500">{p.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-amber-700">
                          {fmtMoney(p.outstanding, currency)} due
                        </div>
                        <div className="text-[10px] text-slate-500">
                          of {fmtMoney(p.total, currency)} total
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedPo && amount > selectedPo.outstanding && (
                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                  ⚠ Payment {fmtMoney(amount, currency)} exceeds outstanding {fmtMoney(selectedPo.outstanding, currency)}.
                  Record as <button className="underline" onClick={() => setKind('GENERAL')}>General payment</button> instead,
                  or split into two payments.
                </div>
              )}
            </div>
          )}

          {kind === 'NEW_GOODS' && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">What did you buy?</div>
              <div className="space-y-1.5">
                {newGoods.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={line.description}
                      onChange={(e) => setNewGoods((prev) => prev.map((l, idx) => idx === i ? { ...l, description: e.target.value } : l))}
                      placeholder="e.g. 30 bags of cement"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.quantity}
                      onChange={(e) => setNewGoods((prev) => prev.map((l, idx) => idx === i ? { ...l, quantity: Number(e.target.value) } : l))}
                      placeholder="Qty"
                      className="w-20"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={line.unitPrice}
                      onChange={(e) => setNewGoods((prev) => prev.map((l, idx) => idx === i ? { ...l, unitPrice: Number(e.target.value) } : l))}
                      placeholder="Unit price"
                      className="w-28"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setNewGoods((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={newGoods.length === 1}
                    >
                      <Trash2 className="w-4 h-4 text-slate-500" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewGoods((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }])}
                  className="text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add line
                </Button>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                We'll record these against {erpMatch.supplierName} so you can see them in the supplier ledger.
                You can convert this into a formal PO later from the Sourcing app.
              </p>
            </div>
          )}

          {kind === 'GENERAL' && (
            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">
              Records this as a general supplier payment — no PO link, no goods reference. Use for
              supplier deposits, retainers, or payments where you don't know yet what specific
              goods/services it covers.
            </div>
          )}

          <div>
            <div className="text-xs font-bold text-slate-700 mb-1">Notes (optional)</div>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember about this payment"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
              {error}
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-700 font-bold"
          >
            Skip — record without linking
          </button>
          <Button
            onClick={submit}
            disabled={saving || (kind === 'PO_PAYMENT' && !purchaseOrderId)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Save reconciliation
          </Button>
        </footer>
      </div>
    </div>
  );
}

function KindCard({
  active, disabled, onClick, icon, label, subtitle,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-3 rounded-xl border text-left transition-colors ${
        active
          ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
          : disabled
            ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg grid place-items-center mb-2 ${
        active ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {icon}
      </div>
      <div className="text-sm font-extrabold">{label}</div>
      <div className="text-[10px] opacity-70 mt-0.5">{subtitle}</div>
    </button>
  );
}
