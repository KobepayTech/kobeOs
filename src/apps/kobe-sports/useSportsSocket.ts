/**
 * useSportsSocket
 *
 * Connects to the /sports Socket.io namespace and subscribes to a match.
 * Provides live frame data, match state snapshots, events, and offside results.
 *
 * Falls back gracefully when the server is unreachable — components continue
 * to work with their demo/DB data.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

const WS_URL =
  (import.meta.env.VITE_API_BASE as string | undefined)
    ?.replace('/api', '')
    ?? 'http://localhost:3000';

// ── Types (mirror server-side shapes) ────────────────────────────────────────

export interface LivePlayer {
  trackId: number;
  class: string; // 'player_home' | 'player_away' | 'goalkeeper_home' | ...
  x: number;
  y: number;
  speed: number;
  jerseyNumber?: number;
}

export interface LiveBall {
  x: number;
  y: number;
  speed: number;
}

export interface LiveFrame {
  matchId: string;
  frameNumber: number;
  matchClock: number;
  half: number;
  ball: LiveBall | null;
  players: LivePlayer[];
}

export interface MatchStateSnapshot {
  matchId: string;
  matchClock: number;
  half: number;
  possession: { home: number; away: number };
  xg: { home: number; away: number };
  xgTimeline: { home: number[]; away: number[] };
  formations: { home: string; away: string };
  events: MatchEvent[];
  heatmaps: { home: number[][]; away: number[][] };
  ball: LiveBall | null;
}

export interface MatchEvent {
  frameNumber: number;
  matchClock: number;
  minute: number;
  type: string;
  team: 'home' | 'away' | null;
  trackId?: number;
  jerseyNumber?: number;
  xg?: number;
  metadata?: Record<string, unknown>;
}

export interface OffsideResult {
  verdict: 'OFFSIDE' | 'ONSIDE' | 'INCONCLUSIVE';
  frameNumber: number;
  matchClock: number;
  minuteStr: string;
  attacker: { trackId: number; x: number; y: number; jerseyNumber?: number };
  lastDefender: { trackId: number; x: number; y: number } | null;
  offsideLineX: number | null;
  marginX: number | null;
  defenderLine: Array<{ trackId: number; x: number; y: number }>;
  timestamp: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface SportsSocketState {
  connected: boolean;
  frame: LiveFrame | null;
  matchState: MatchStateSnapshot | null;
  latestEvent: MatchEvent | null;
  latestOffside: OffsideResult | null;
  offsideHistory: OffsideResult[];
}

export function useSportsSocket(matchId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SportsSocketState>({
    connected: false,
    frame: null,
    matchState: null,
    latestEvent: null,
    latestOffside: null,
    offsideHistory: [],
  });

  useEffect(() => {
    if (!matchId) return;

    const socket = io(`${WS_URL}/sports`, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setState((s) => ({ ...s, connected: true }));
      socket.emit('watch:match', matchId);
    });

    socket.on('disconnect', () => {
      setState((s) => ({ ...s, connected: false }));
    });

    socket.on('frame', (data: LiveFrame) => {
      setState((s) => ({ ...s, frame: data }));
    });

    socket.on('match:state', (data: MatchStateSnapshot) => {
      setState((s) => ({ ...s, matchState: data }));
    });

    socket.on('match:event', (data: MatchEvent) => {
      setState((s) => ({ ...s, latestEvent: data }));
    });

    socket.on('offside', (data: OffsideResult) => {
      setState((s) => ({
        ...s,
        latestOffside: data,
        offsideHistory: [data, ...s.offsideHistory.slice(0, 19)],
      }));
    });

    return () => {
      socket.emit('unwatch');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId]);

  const watchMatch = useCallback((id: string) => {
    socketRef.current?.emit('watch:match', id);
  }, []);

  return { ...state, watchMatch };
}
