import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { matchesApi, type Match } from './api';

const WS_URL =
  (import.meta.env.VITE_API_BASE as string | undefined)
    ?.replace('/api', '')
    ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

/**
 * Streams the operator's currently-live matches.
 *
 * `liveMatches` is polled from the authenticated REST feed (GET
 * /sports/matches/live — matches that are LIVE with tracking active), which is
 * the real, owner-scoped source. `connected` reflects a genuine socket.io
 * connection to the /sports namespace, so the "Live feed" indicator is honest.
 * Any lifecycle/frame broadcast triggers an immediate refetch.
 */
export function useLiveMatches() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      matchesApi.getLive()
        .then((rows) => { if (active) setLiveMatches(Array.isArray(rows) ? rows : []); })
        .catch(() => { /* offline — keep the last snapshot */ });
    };

    refresh();
    const poll = setInterval(refresh, 8000);

    const socket = io(`${WS_URL}/sports`, {
      transports: ['websocket'],
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); refresh(); });
    socket.on('disconnect', () => setConnected(false));
    // When any match changes state or a live-data poll lands, pull the fresh list.
    const bump = () => refresh();
    socket.on('match:started', bump);
    socket.on('match:ended', bump);
    socket.on('match:halftime', bump);
    socket.on('match:score', bump);
    socket.on('live-matches', bump);

    return () => {
      active = false;
      clearInterval(poll);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { liveMatches, connected };
}
