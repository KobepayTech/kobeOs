import { useEffect } from 'react';
import { api } from '@/lib/api';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — matches backend stale threshold

// Build-time constant injected by vite.config.ts — no env var needed on user machines.
const REGISTRY_URL = typeof __REGISTRY_URL__ !== 'undefined'
  ? __REGISTRY_URL__
  : 'https://kobeos-registry.onrender.com';

/**
 * Sends a heartbeat to the local KobeOS API every 5 minutes while the
 * store is published. The local API (PublishService) forwards it to the
 * central registry so the DNS record stays marked as active.
 *
 * Zero configuration required — registry URL and token are baked into
 * the build. End users just install KobeOS and click Publish.
 */
export function useStoreHeartbeat(slug: string | undefined, isPublished: boolean) {
  useEffect(() => {
    if (!isPublished || !slug) return;

    // Fire-and-forget — heartbeat failures are non-critical.
    // The local backend holds the token; the frontend just triggers the call.
    const send = () => {
      void api('/store-settings/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ slug, registryUrl: REGISTRY_URL }),
      }).catch(() => {
        // Silently ignore — the backend cron will mark stale after 10 min
      });
    };

    send();
    const timer = setInterval(send, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPublished, slug]);
}
