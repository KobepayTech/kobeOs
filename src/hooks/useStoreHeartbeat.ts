import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — matches backend stale threshold

/**
 * Sends a heartbeat to the local KobeOS API every 5 minutes while the
 * store is published. The local API (PublishService) forwards it to the
 * central registry so the DNS record stays marked as active.
 *
 * Call this in the StoreEditor whenever `isPublished` is true.
 *
 * @param slug       The store's domainSlug, e.g. "kelvinfashion"
 * @param isPublished Whether the store is currently published
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
        body: JSON.stringify({ slug: slugRef.current }),
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
