import { useEffect, useState } from 'react';
import { Cpu, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import KobeAssistant from '@/apps/kobe-assistant';
import { api, apiObject } from '@/lib/api';

interface InstalledModel {
  name: string;
  size?: number;
  modifiedAt?: string;
}

interface GatewayStatus {
  online: boolean;
  node: 'desktop' | 'server';
  transport: string;
  directOllamaExposure: boolean;
  activeModel: string;
  installedModels: InstalledModel[];
  capabilities: string[];
  remoteReady: boolean;
}

/**
 * Ask Kobe from the mobile staff PWA. The phone never downloads or directly
 * connects to Ollama. It authenticates to the KobeOS API and the Kobe AI
 * gateway runs inference on the models installed on that KobeOS node. This is
 * the same contract whether the phone reaches the computer through its store
 * tunnel or another authenticated KobeOS URL.
 */
export function MobileAssistant() {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<InstalledModel[]>([]);
  const [activeModel, setActiveModel] = useState('');
  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelError, setModelError] = useState('');

  const refreshModels = async () => {
    setModelBusy(true);
    setModelError('');
    try {
      const response = await api<unknown>('/ai/gateway/status', { offlineFallback: false });
      const status = apiObject<GatewayStatus>(response);
      if (!status) throw new Error('Invalid gateway response');
      setGateway(status);
      setModels(status.installedModels ?? []);
      setActiveModel(status.activeModel ?? '');
      if (!status.online) setModelError('The Kobe AI runtime on this node is offline. Start the local model runtime and retry.');
    } catch {
      setGateway(null);
      setModels([]);
      setModelError('This phone could not reach the authenticated Kobe AI gateway.');
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
      setGateway((current) => current ? { ...current, activeModel: model } : current);
    } catch {
      setModelError('KobeOS could not switch the active model.');
    } finally {
      setModelBusy(false);
    }
  };

  const nodeLabel = gateway?.node === 'desktop' ? 'KobeOS PC' : 'KobeOS server';

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[9998]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-[#071321] shadow-2xl">
            <div className="shrink-0 border-b border-white/10 px-3 py-2 text-white">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-violet-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">Kobe AI model gateway</p>
                  <p className="truncate text-[10px] text-slate-400">
                    {gateway
                      ? `${nodeLabel} · ${models.length} model${models.length === 1 ? '' : 's'} · ${gateway.online ? 'online' : 'offline'}`
                      : 'Connecting to your KobeOS AI node'}
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
                  {models.map((item) => (
                    <option key={item.name} value={item.name} className="text-black">{item.name}</option>
                  ))}
                </select>
                <button onClick={() => void refreshModels()} disabled={modelBusy} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80 disabled:opacity-50" aria-label="Refresh models">
                  {modelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
                <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80" aria-label="Close assistant">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {gateway?.capabilities?.length ? (
                <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
                  {gateway.capabilities.map((capability) => (
                    <span key={capability} className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[8px] font-black tracking-wide text-slate-300">
                      {capability.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              ) : null}
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
