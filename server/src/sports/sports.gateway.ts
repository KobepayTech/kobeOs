/**
 * SportsGateway — WebSocket gateway for live match state.
 *
 * Events emitted to clients:
 *   'frame'        — every vision frame (player positions, ball, clock)
 *   'match:state'  — full state snapshot throttled to 1/s (possession, xG, heatmaps)
 *   'match:event'  — significant match event (goal, card, offside)
 *   'offside'      — offside check result from OffsideDetectionService
 *
 * Events received from clients:
 *   'watch:match'  — subscribe to a matchId room
 *   'unwatch'      — leave current match room
 */

import {
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { VisionIngestService, type LiveMatchState } from './vision-ingest.service';
import type { OffsideResult } from './offside-detection.service';

const STATE_THROTTLE_MS = 1000;

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/sports' })
export class SportsGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(SportsGateway.name);
  private readonly lastStateSent = new Map<string, number>();

  constructor(private readonly vision: VisionIngestService) {
    this.vision.onFrame((matchId, state) => this.onVisionFrame(matchId, state));
  }

  afterInit() {
    this.logger.log('SportsGateway initialised on /sports');
  }

  @SubscribeMessage('watch:match')
  handleWatch(@MessageBody() matchId: string, @ConnectedSocket() client: Socket) {
    [...client.rooms].filter((r) => r !== client.id).forEach((r) => client.leave(r));
    client.join(`match:${matchId}`);
    this.logger.log(`Client ${client.id} watching match ${matchId}`);
    const state = this.vision.getLiveState(matchId);
    if (state) client.emit('match:state', this.buildStatePayload(state));
    return { ok: true, matchId };
  }

  @SubscribeMessage('unwatch')
  handleUnwatch(@ConnectedSocket() client: Socket) {
    [...client.rooms].filter((r) => r !== client.id).forEach((r) => client.leave(r));
    return { ok: true };
  }

  private onVisionFrame(matchId: string, state: LiveMatchState) {
    const room = `match:${matchId}`;

    // Lightweight frame — every frame
    this.server.to(room).emit('frame', {
      matchId,
      frameNumber: state.frameNumber,
      matchClock: state.matchClock,
      half: state.half,
      ball: state.ball,
      players: state.players.map((p) => ({
        trackId: p.trackId,
        class: p.class,
        x: p.x, y: p.y,
        speed: p.speed,
        jerseyNumber: p.jerseyNumber,
      })),
    });

    // Full state — throttled to 1/s
    const now = Date.now();
    if (now - (this.lastStateSent.get(matchId) ?? 0) >= STATE_THROTTLE_MS) {
      this.server.to(room).emit('match:state', this.buildStatePayload(state));
      this.lastStateSent.set(matchId, now);
    }

    // New event — immediate
    const latest = state.events.at(-1);
    if (latest?.frameNumber === state.frameNumber) {
      this.server.to(room).emit('match:event', latest);
    }
  }

  pushOffsideResult(matchId: string, result: OffsideResult) {
    this.server.to(`match:${matchId}`).emit('offside', result);
  }

  private buildStatePayload(state: LiveMatchState) {
    const total = state.possessionFrames.home + state.possessionFrames.away || 1;
    return {
      matchId: state.matchId,
      matchClock: state.matchClock,
      half: state.half,
      possession: {
        home: Math.round((state.possessionFrames.home / total) * 100),
        away: Math.round((state.possessionFrames.away / total) * 100),
      },
      xg: state.xg,
      xgTimeline: state.xgTimeline,
      formations: state.formations,
      events: state.events.slice(-20),
      heatmaps: state.heatmaps,
      ball: state.ball,
    };
  }
}
