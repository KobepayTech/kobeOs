import { useEffect, useRef, useState } from 'react';
import type { Match } from './api';

/**
 * Connects to the /sports WebSocket namespace and streams live match updates.
 * Falls back gracefully when the backend is unavailable.
 */
export function useLiveMatches() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Use native WebSocket — no socket.io client dep needed for simple subscribe
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/socket.io/?EIO=4&transport=websocket&ns=/sports`;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          // Send socket.io connect packet for the /sports namespace
          ws.send('40/sports,');
          // Request current live matches
          ws.send('42/sports,["get-live-matches"]');
        };

        ws.onmessage = (evt) => {
          const data = String(evt.data);
          // socket.io event packet: 42/sports,["live-matches", [...]]
          if (data.startsWith('42/sports,')) {
            try {
              const payload = JSON.parse(data.slice('42/sports,'.length));
              if (Array.isArray(payload) && payload[0] === 'live-matches' && Array.isArray(payload[1])) {
                setLiveMatches(payload[1] as Match[]);
              }
            } catch { /* ignore malformed */ }
          }
        };

        ws.onclose = () => {
          setConnected(false);
          // Reconnect after 10s
          reconnectTimer = setTimeout(connect, 10_000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        // WebSocket not available (SSR / test env)
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  return { liveMatches, connected };
}
