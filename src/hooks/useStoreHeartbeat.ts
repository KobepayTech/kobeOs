import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — matches backend stale threshold

// Use baked-in build-time constants (injected by vite.config.ts define block).
// These are replaced at compile time — no runtime env vars needed on user machines.
const REGISTRY_URL    = typeof __REGISTRY_URL__    !== 'undefined' ? __REGISTRY_URL__    : 'https://kobeos-registry.onrender.com';
const HEARTBEAT_TOKEN = typeof __HEARTBEAT_TOKEN__ !== 'undefined' ? __HEARTBEAT_TOKEN__ : '';

/**
 * Sends a heartbeat to the local KobeOS API every 5 minutes while the
 * store is published. The local API (PublishService) forwards it to the
 * central registry so the DNS record stays marked as active.
 *
 * Zero configuration required — registry URL and token are baked into
 * the build. End users just install KobeOS and click Publish.
 */
export function useStoreHeartbeat(slug: string | undefined, isPublished: boolean) {
  const slugRef = useRef(slug);
  slugRef.current = slug;

  useEffect(() => {
    if (!isPublished || !slug) return;

    const send = () => {
      if (!slugRef.current) return;
      // Fire-and-forget — heartbeat failures are non-critical
      api('/store-settings/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          slug: slugRef.current,
          registryUrl: REGISTRY_URL,
          token: HEARTBEAT_TOKEN,
        }),
      }).catch(() => {
        // Silently ignore — the backend cron will mark stale after 10 min
      });
    };

    // Send immediately on mount, then every 5 minutes
    send();
    const timer = setInterval(send, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPublished, slug]);
}
