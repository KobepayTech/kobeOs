import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Zap, ShieldCheck, Pencil, Save, X, Loader2 } from 'lucide-react';

/**
 * Owner-facing CRUD for the auto-approval rules engine. Each rule is an
 * AND-set of conditions; the lowest-priority matching rule lets the request
 * skip the owner queue entirely. Maps to the backend's existing
 * /discounts/rules endpoints + DiscountApprovalRule entity.
 */
interface DiscountRule {
  id: string;
  ruleName: string;
  description: string | null;
  maxDiscountPercent: number | null;
  minMarginPercent: number | null;
  minCustomerTier: string | null;
  minQuantity: number | null;
  allowedSellerRoles: string[] | null;
  isActive: boolean;
  priority: number;
  expiryMinutes: number | null;
}

const BLANK: Omit<DiscountRule, 'id'> = {
  ruleName: '',
  description: '',
  maxDiscountPercent: 10,
  minMarginPercent: 25,
  minCustomerTier: null,
  minQuantity: null,
  allowedSellerRoles: null,
  isActive: true,
  priority: 100,
  expiryMinutes: null,
};

export function DiscountRulesManager() {
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DiscountRule | null>(null);
  const [creating, setCreating] = useState<Omit<DiscountRule, 'id'> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api<DiscountRule[]>('/discounts/rules');
      setRules([...(rows ?? [])].sort((a, b) => a.priority - b.priority));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveRule = async (payload: DiscountRule | Omit<DiscountRule, 'id'>) => {
    setSaving(true);
    setError(null);
    try {
      if ('id' in payload) {
        await api(`/discounts/rules/${payload.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/discounts/rules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      setCreating(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Delete rule "${name}"? Existing pending requests are not affected.`)) return;
    try {
      await api(`/discounts/rules/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Auto-approval Rules</h2>
            <p className="text-[11px] text-white/40">
              Requests that match a rule skip the owner queue. Rules are checked in priority order (lowest first).
            </p>
          </div>
        </div>
        <Button onClick={() => setCreating(BLANK)} className="bg-amber-600 hover:bg-amber-500">
          <Plus className="w-4 h-4 mr-1.5" /> New rule
        </Button>
      </div>

      {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">{error}</div>}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading rules…
        </div>
      )}

      {creating && (
        <RuleForm value={creating as DiscountRule} onSubmit={saveRule} onCancel={() => setCreating(null)} saving={saving} />
      )}

      {!loading && rules.map((rule) => (
        editing?.id === rule.id ? (
          <RuleForm key={rule.id} value={editing} onSubmit={saveRule} onCancel={() => setEditing(null)} saving={saving} />
        ) : (
          <RuleRow key={rule.id} rule={rule} onEdit={() => setEditing(rule)} onDelete={() => remove(rule.id, rule.ruleName)} />
        )
      ))}

      {!loading && !rules.length && !creating && (
        <Card className="bg-white/[0.02] border-white/10 text-center">
          <CardContent className="p-8 space-y-2">
            <ShieldCheck className="w-8 h-8 mx-auto text-white/30" />
            <p className="text-sm text-white/60">No auto-approval rules yet.</p>
            <p className="text-xs text-white/40">
              Every discount request currently waits for owner approval. Add a rule to fast-track common cases.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RuleRow({ rule, onEdit, onDelete }: { rule: DiscountRule; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="bg-[#13131f] border-white/10">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={rule.isActive ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-white/40'}>
              {rule.isActive ? 'Active' : 'Disabled'}
            </Badge>
            <span className="text-sm font-semibold text-white">{rule.ruleName}</span>
            <span className="text-[11px] text-white/40">priority {rule.priority}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit} className="text-white/60 hover:text-white">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-white/60 hover:text-rose-300">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        {rule.description && <p className="text-xs text-white/50">{rule.description}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <Cond label="Max discount" value={rule.maxDiscountPercent !== null ? `${rule.maxDiscountPercent}%` : '—'} />
          <Cond label="Min margin" value={rule.minMarginPercent !== null ? `${rule.minMarginPercent}%` : '—'} />
          <Cond label="Min qty" value={rule.minQuantity !== null ? String(rule.minQuantity) : '—'} />
          <Cond label="Min tier" value={rule.minCustomerTier ?? '—'} />
        </div>
      </CardContent>
    </Card>
  );
}

function Cond({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1">
      <div className="text-white/40 text-[10px] uppercase tracking-wide">{label}</div>
      <div className="text-white font-medium">{value}</div>
    </div>
  );
}

function RuleForm({
  value,
  onSubmit,
  onCancel,
  saving,
}: {
  value: DiscountRule;
  onSubmit: (v: DiscountRule | Omit<DiscountRule, 'id'>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const patch = (p: Partial<DiscountRule>) => setDraft({ ...draft, ...p });

  return (
    <Card className="bg-amber-500/5 border-amber-500/30">
      <CardContent className="p-4 space-y-3">
        <Input
          placeholder="Rule name (e.g. Small discounts)"
          value={draft.ruleName}
          onChange={(e) => patch({ ruleName: e.target.value })}
          className="bg-white/5 border-white/10"
        />
        <Input
          placeholder="Description (optional)"
          value={draft.description ?? ''}
          onChange={(e) => patch({ description: e.target.value })}
          className="bg-white/5 border-white/10 text-xs"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <NumField label="Max discount %" value={draft.maxDiscountPercent} onChange={(v) => patch({ maxDiscountPercent: v })} />
          <NumField label="Min margin %" value={draft.minMarginPercent} onChange={(v) => patch({ minMarginPercent: v })} />
          <NumField label="Min quantity" value={draft.minQuantity} onChange={(v) => patch({ minQuantity: v })} />
          <NumField label="Priority" value={draft.priority} onChange={(v) => patch({ priority: v ?? 100 })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Min customer tier (e.g. VIP)"
            value={draft.minCustomerTier ?? ''}
            onChange={(e) => patch({ minCustomerTier: e.target.value || null })}
            className="bg-white/5 border-white/10 text-xs"
          />
          <NumField label="Expiry override (min)" value={draft.expiryMinutes} onChange={(v) => patch({ expiryMinutes: v })} />
        </div>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input type="checkbox" checked={draft.isActive} onChange={(e) => patch({ isActive: e.target.checked })} />
          Active (rule is enforced when checked)
        </label>
        <div className="flex gap-2 pt-1">
          <Button onClick={() => onSubmit(draft)} disabled={saving || !draft.ruleName.trim()} className="bg-emerald-600 hover:bg-emerald-500">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button onClick={onCancel} variant="ghost">
            <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label className="text-[10px] text-white/40 uppercase">{label}</label>
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="bg-white/5 border-white/10 text-sm"
      />
    </div>
  );
}
