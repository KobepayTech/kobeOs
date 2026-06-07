import { useState } from 'react';
import { Store, Check, Plus, Loader2, MapPin } from 'lucide-react';
import { useActiveShop } from '@/hooks/useActiveShop';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Sits in the OS taskbar / launcher header. Shows the active shop name with
 * a dropdown to switch between shops and a "+ Add shop" entry that opens
 * an inline create dialog.
 */
export function ShopSwitcher({ compact = false }: { compact?: boolean }) {
  const { shops, activeShop, setActiveId, reload, loading } = useActiveShop();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '', region: '', openingFloat: 0 });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const shop = await api<{ id: string }>('/shops', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      await reload();
      setActiveId(shop.id);
      setCreating(false);
      setForm({ name: '', address: '', phone: '', region: '', openingFloat: 0 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="relative inline-block">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors ${
            compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
          }`}
          title="Switch shop"
        >
          <Store className="w-3.5 h-3.5 text-amber-300" />
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin text-white/40" />
          ) : (
            <span className="font-medium text-white">{activeShop?.name ?? 'No shop'}</span>
          )}
          <span className="text-white/40">▾</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-64 bg-[#13131f] border border-white/10 rounded-md shadow-xl z-50 py-1">
            {shops.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveId(s.id);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-white/[0.04] flex items-start gap-2"
              >
                <div className="flex-1">
                  <div className="text-xs font-medium text-white flex items-center gap-1.5">
                    {s.name}
                    {s.isDefault && (
                      <span className="text-[9px] uppercase bg-amber-500/15 text-amber-300 px-1 rounded">Default</span>
                    )}
                  </div>
                  {(s.address || s.region) && (
                    <div className="text-[10px] text-white/40 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" /> {[s.region, s.address].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                {s.id === activeShop?.id && <Check className="w-3.5 h-3.5 text-emerald-300" />}
              </button>
            ))}
            <button
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
              className="w-full text-left px-3 py-2 hover:bg-white/[0.04] flex items-center gap-2 border-t border-white/5"
            >
              <Plus className="w-3.5 h-3.5 text-blue-300" />
              <span className="text-xs font-medium text-blue-300">Add another shop</span>
            </button>
          </div>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="bg-[#13131f] border border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a shop</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              placeholder="Shop name (e.g. Mwanza Branch)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-white/5 border-white/10"
            />
            <Input
              placeholder="Region (e.g. Kariakoo)"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="bg-white/5 border-white/10"
            />
            <Input
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="bg-white/5 border-white/10"
            />
            <Input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="bg-white/5 border-white/10"
            />
            <Input
              type="number"
              placeholder="Opening float (TZS)"
              value={form.openingFloat}
              onChange={(e) => setForm({ ...form, openingFloat: Number(e.target.value) })}
              className="bg-white/5 border-white/10"
            />
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !form.name.trim()} className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                {saving ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
