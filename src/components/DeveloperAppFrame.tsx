import { useEffect, useMemo, useRef } from 'react';
import { developerApi, type DeveloperPackage } from '@/lib/developerApps';
import { developerAppDocument } from '@/os/developer-app-frame';
export function DeveloperAppFrame({ app, preview = false }: { app: DeveloperPackage; preview?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const session = useMemo(() => crypto.randomUUID(), [app]);
  const document = useMemo(() => developerAppDocument(app.html, session), [app.html, session]);
  useEffect(() => {
    let active = true; let busy = 0; let calls = 0; let windowStart = Date.now();
    const onMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== frame.current?.contentWindow || !data || data.session !== session || data.type !== 'kobe-app-request' || typeof data.id !== 'string' || !/^\d{1,12}$/.test(data.id)) return;
      const respond = (value: { result?: unknown; error?: string }) => { if (active) frame.current?.contentWindow?.postMessage({ type: 'kobe-app-response', session, id: data.id, ...value }, '*'); };
      if (Date.now() - windowStart > 60000) { calls = 0; windowStart = Date.now(); }
      if (++calls > 30 || busy > 0) { respond({ error: 'Please wait before refreshing again.' }); return; }
      if (data.method !== 'inventory.read' || !app.manifest.permissions.includes('inventory.read')) { respond({ error: 'This app does not have that permission.' }); return; }
      busy++;
      try {
        const result = preview ? { items: [{ id: 'demo-1', name: 'Sample caps', sku: 'CAP-01', stock: 2, unit: 'piece' }, { id: 'demo-2', name: 'Sample shirts', sku: 'SHIRT-01', stock: 12, unit: 'piece' }], hasMore: false } : await developerApi(`/installed/${encodeURIComponent(app.manifest.id)}/inventory?version=${encodeURIComponent(app.manifest.version)}`);
        respond({ result });
      } catch (error) { respond({ error: error instanceof Error ? error.message : 'Inventory is unavailable.' }); }
      finally { busy--; }
    };
    window.addEventListener('message', onMessage);
    return () => { active = false; window.removeEventListener('message', onMessage); };
  }, [app.manifest.id, app.manifest.permissions, app.manifest.version, preview, session]);
  return <iframe ref={frame} title={app.manifest.name} sandbox="allow-scripts" allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'" referrerPolicy="no-referrer" srcDoc={document} className="h-full min-h-[460px] w-full border-0 bg-white" />;
}
