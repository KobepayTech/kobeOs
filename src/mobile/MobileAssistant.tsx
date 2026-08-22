import { useEffect, useState } from 'react';
import { Cpu, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import KobeAssistant from '@/apps/kobe-assistant';
import { api, apiArray, apiObject } from '@/lib/api';

interface InstalledModel {
  name?: string;
  model?: string;
  size?: number;
  modified_at?: string;
}

/**
 * Ask Kobe on the mobile staff PWA. The assistant runs against the same
 * authenticated KobeOS backend that serves this mobile workspace, so when the
 * workspace is opened through the shop's KobeOS tunnel the phone is using the
 * AI models installed on that KobeOS computer — the model is not downloaded to
 * the phone.
 */
export function MobileAssistant() {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<InstalledModel[]>([]);
  const [activeModel, setActiveModel] = useState('');
  const [modelBusy, setModelBusy] = useState(false);
  const [modelError, setModelError] = useState('');

  const refreshModels = async () => {
    setModelBusy(true);
    setModelError('');
    try {
      const [installedResponse, activeResponse] = await Promise.all([
        api<unknown>('/ai/models/installed', { offlineFallback: false }),
        api<unknown>('/ai/models/active', { offlineFallback: false }),
      ]);
      const installed = apiArray<InstalledModel>(installedResponse, ['models']);
      const active = apiObject<{ model?: string }>(activeResponse);
      setModels(installed);
      setActiveModel(active?.model ?? '');
    } catch {
      setModels([]);
      setModelError('This KobeOS node could not report its installed models.');
    } finally {
      setModelBusy(false);
    }
  };

  useEffect(() => {
    if (open) void refreshModels();
  }, [open]);

  const selectModel = async (model: string) => {
    if (!model || model === activeModel) return;
    setModelBusy(true);
    setModelError('');
    try {
      await api('/ai/models/active', {
        method: 'PUT',
        body: JSON.stringify({ model }),
        offlineFallback: false,
      });
      setActiveModel(model);
    } catch {
      setModelError('KobeOS could not switch the active model.');
    } finally {
      setModelBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[9998]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-[#071321] shadow-2xl">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 text-white">
              <Cpu className="h-4 w-4 text-violet-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">KobeOS node AI</p>
                <p className="truncate text-[10px] text-slate-400">
                  {activeModel ? `Using ${activeModel} on this KobeOS computer` : 'Auto-selecting the best available local model'}
                </p>
              </div>
              <select
                aria-label="AI model"
                value={activeModel}
                onChange={(event) => void selectModel(event.target.value)}
                disabled={modelBusy || models.length === 0}
                className="max-w-[42%] rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[10px] font-bold text-white outline-none disabled:opacity-50"
              >
                {!activeModel && <option value="">Auto</option>}
                {models.map((item) => {
                  const name = item.name ?? item.model ?? '';
                  return name ? <option key={name} value={name} className="text-black">{name}</option> : null;
                })}
              </select>
              <button onClick={() => void refreshModels()} disabled={modelBusy} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80 disabled:opacity-50" aria-label="Refresh models">
                {modelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80" aria-label="Close assistant">
                <X className="h-4 w-4" />
              </button>
            </div>
            {modelError && <div className="shrink-0 bg-amber-400/10 px-3 py-1.5 text-[10px] font-semibold text-amber-200">{modelError}</div>}
            <div className="min-h-0 flex-1">
              <KobeAssistant responseMode="fast" contextLabel="KobeOS mobile" />
            </div>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-[9997] grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl transition-transform active:scale-95"
          aria-label="Ask Kobe AI"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}
    </>
  );
}
