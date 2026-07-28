import { useState } from 'react';
import { Building2, CheckCircle2, Plus } from 'lucide-react';
import PropEasy from './PropEasy';
import PropertyOnboardingWizard from './PropertyOnboardingWizard';

export default function PropertyApp() {
  const [mode, setMode] = useState<'portfolio' | 'onboard'>('portfolio');
  const [created, setCreated] = useState<string | null>(null);

  if (mode === 'onboard') {
    return (
      <PropertyOnboardingWizard
        onCancel={() => setMode('portfolio')}
        onCreated={(result) => {
          setCreated(`${result.property.name} created with ${result.units.length} rooms.`);
          setMode('portfolio');
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-slate-900">Property portfolio</div>
          <div className="text-[11px] text-slate-500">Buildings, corridors, rooms, tenants, rent, and payment tokens</div>
        </div>
        <button
          onClick={() => setMode('onboard')}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white shadow-sm hover:bg-blue-500"
        >
          <Plus className="h-3.5 w-3.5" /> Add property + rooms
        </button>
      </div>
      {created && (
        <button
          onClick={() => setCreated(null)}
          className="flex shrink-0 items-center justify-center gap-2 border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
        >
          <CheckCircle2 className="h-4 w-4" /> {created}
        </button>
      )}
      <div className="min-h-0 flex-1">
        <PropEasy />
      </div>
    </div>
  );
}
