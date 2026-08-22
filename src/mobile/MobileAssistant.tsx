// MobileAssistant.tsx
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Cpu, Loader2, RefreshCw, Sparkles, X, AlertCircle, CheckCircle, WifiOff } from 'lucide-react';
import KobeAssistant from '@/apps/kobe-assistant';
import { api, apiObject } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InstalledModel {
  name: string;
  size?: number;
  modifiedAt?: string;
  id?: string;
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

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Mobile uses the authenticated KobeOS model gateway. The phone never downloads
 * a model and never gets direct Ollama access; inference remains on the KobeOS
 * computer/server serving this workspace.
 */
export function MobileAssistant() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [models, setModels] = useState<InstalledModel[]>([]);
  const [activeModel, setActiveModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // ─── Computed Values ──────────────────────────────────────────────────────

  const nodeLabel = useMemo(() => {
    if (!gateway) return 'Connecting...';
    return gateway.node === 'desktop' ? 'KobeOS PC' : 'KobeOS Server';
  }, [gateway]);

  const connectionStatus = useMemo(() => {
    if (!gateway) return 'connecting';
    return gateway.online ? 'online' : 'offline';
  }, [gateway]);

  const modelCount = useMemo(() => models.length, [models]);

  // ─── API Calls ────────────────────────────────────────────────────────────

  const refreshModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api<unknown>('/ai/gateway/status', { 
        offlineFallback: false,
        timeout: 10000,
      });
      
      const status = apiObject<GatewayStatus>(response);
      if (!status) {
        throw new Error('Invalid gateway response');
      }

      if (!isMountedRef.current) return;

      setGateway(status);
      setModels(Array.isArray(status.installedModels) ? status.installedModels : []);
      setActiveModel(status.activeModel ?? '');
      setLastRefreshed(new Date());

      if (!status.online) {
        setError('The Kobe AI runtime on this node is offline. Please ensure Ollama is running.');
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch gateway status:', errorMessage);
      
      setGateway(null);
      setModels([]);
      setActiveModel('');
      setError('This phone could not reach the authenticated Kobe AI gateway.');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const selectModel = useCallback(async (model: string) => {
    if (!model || model === activeModel || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await api('/ai/models/active', {
        method: 'PUT',
        body: JSON.stringify({ model }),
        offlineFallback: false,
        timeout: 15000,
      });

      if (!isMountedRef.current) return;

      setActiveModel(model);
      setGateway((current) => 
        current ? { ...current, activeModel: model } : current
      );
      
      console.log(`Model switched to: ${model}`);
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to switch model:', errorMessage);
      
      setError(`KobeOS could not switch the active model. ${errorMessage}`);
      
      // Refresh to get current state
      await refreshModels();
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeModel, isLoading, refreshModels]);

  // ─── Effects ──────────────────────────────────────────────────────────────

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  // Fetch status when opened and set up auto-refresh
  useEffect(() => {
    if (isOpen) {
      // Initial fetch
      refreshModels();
      
      // Auto-refresh every 30 seconds
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      
      refreshIntervalRef.current = setInterval(() => {
        if (isMountedRef.current && isOpen) {
          refreshModels();
        }
      }, 30000);
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    } else {
      // Clean up when closed
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, [isOpen, refreshModels]);

  // ─── Event Handlers ──────────────────────────────────────────────────────

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleRefresh = useCallback(() => {
    refreshModels();
  }, [refreshModels]);

  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    selectModel(event.target.value);
  }, [selectModel]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[9998]">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" 
            onClick={handleClose}
            aria-hidden="true"
          />
          
          {/* Modal */}
          <div className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-[#071321] shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="shrink-0 border-b border-white/10 px-3 py-2 text-white bg-white/5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Cpu className="h-4 w-4 text-violet-300" />
                  {connectionStatus === 'online' && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#071321]" />
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-300 flex items-center gap-1.5">
                    Kobe AI model gateway
                    {connectionStatus === 'online' && (
                      <CheckCircle className="h-3 w-3 text-emerald-400" />
                    )}
                    {connectionStatus === 'offline' && (
                      <WifiOff className="h-3 w-3 text-amber-400" />
                    )}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {gateway
                      ? `${nodeLabel} · ${modelCount} model${modelCount === 1 ? '' : 's'} · ${connectionStatus}`
                      : 'Connecting to your KobeOS AI node...'}
                  </p>
                </div>

                {/* Model Selector */}
                <select
                  aria-label="AI model"
                  value={activeModel}
                  onChange={handleModelChange}
                  disabled={isLoading || modelCount === 0 || connectionStatus === 'offline'}
                  className="max-w-[42%] rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[10px] font-bold text-white outline-none transition-all hover:bg-white/20 focus:border-violet-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!activeModel && <option value="">Auto</option>}
                  {models.map((item) => (
                    <option key={item.name || item.id} value={item.name || item.id} className="text-black">
                      {item.name || item.id}
                    </option>
                  ))}
                </select>

                {/* Action Buttons */}
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80 transition-all hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Refresh models"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white"
                  aria-label="Close assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Capabilities */}
              {gateway?.capabilities && gateway.capabilities.length > 0 && (
                <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
                  {gateway.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[8px] font-black tracking-wide text-slate-300 border border-white/5"
                    >
                      {capability.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="shrink-0 bg-amber-400/10 border-b border-amber-400/20 px-3 py-1.5 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-200 flex-shrink-0" />
                <p className="text-[10px] font-semibold text-amber-200 flex-1">{error}</p>
              </div>
            )}

            {/* Last Refreshed */}
            {lastRefreshed && !error && (
              <div className="shrink-0 px-4 py-0.5 text-right">
                <span className="text-[8px] text-slate-500">
                  Updated {lastRefreshed.toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Chat Interface */}
            <div className="min-h-0 flex-1">
              <KobeAssistant 
                responseMode="fast" 
                contextLabel="KobeOS mobile" 
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={handleToggle}
          className="fixed bottom-20 right-4 z-[9997] group grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-purple-500/50 active:scale-95"
          aria-label="Ask Kobe AI"
        >
          <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-12" />
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#071321] animate-pulse" />
        </button>
      )}
    </>
  );
}

// ─── Add to global CSS ──────────────────────────────────────────────────────

/*
@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
*/