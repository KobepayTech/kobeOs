/**
 * SportsAiService
 *
 * Auto-generates AI commentary and tactical reports triggered by match events.
 * Uses the existing AiService (Ollama/DeepSeek) with football-specific prompts.
 *
 * Triggers:
 *   - GOAL → immediate commentary snippet
 *   - HT / FT → full tactical report
 *   - Every 15 minutes of match time → rolling commentary update
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchAnalytics, SportsMatch, MatchEvent } from './sports.entity';
import { AiService } from '../ai/ai.service';
import { VisionIngestService } from './vision-ingest.service';
import { SportsGateway } from './sports.gateway';

@Injectable()
export class SportsAiService {
  private readonly logger = new Logger(SportsAiService.name);

  /** Track last commentary minute per match to avoid duplicates */
  private readonly lastCommentaryMinute = new Map<string, number>();

  constructor(
    @InjectRepository(MatchAnalytics)
    private readonly analyticsRepo: Repository<MatchAnalytics>,
    @InjectRepository(SportsMatch)
    private readonly matchRepo: Repository<SportsMatch>,
    @InjectRepository(MatchEvent)
    private readonly eventRepo: Repository<MatchEvent>,
    private readonly ai: AiService,
    private readonly vision: VisionIngestService,
    private readonly gateway: SportsGateway,
  ) {}

  // ── Event-triggered commentary ────────────────────────────────────────────

  /**
   * Called when a significant match event is recorded (GOAL, PENALTY, RED_CARD, VAR, OWN_GOAL).
   * Generates a short commentary snippet and pushes it via WebSocket.
   */
  async onMatchEvent(
    matchId: string,
    event: {
      type: string;
      minute: number;
      team?: string;
      playerName?: string;
      description?: string;
    },
  ): Promise<void> {
    const triggerTypes = ['GOAL', 'PENALTY', 'RED_CARD', 'VAR', 'OWN_GOAL'];
    if (!triggerTypes.includes(event.type)) return;

    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) return;

    const state = this.vision.getLiveState(matchId);
    const minute = state ? Math.floor(state.matchClock / 60) : event.minute;
    const total = (state?.possessionFrames.home ?? 0) + (state?.possessionFrames.away ?? 0) || 1;
    const homePoss = Math.round(((state?.possessionFrames.home ?? 0) / total) * 100);

    const context: Record<string, unknown> = {
      minute: event.minute,
      team: event.team,
      playerName: event.playerName,
      description: event.description,
    };
    const prompt = this.buildEventPrompt(event.type, match, minute, homePoss, context);

    try {
      const commentary = await this.ai.complete(prompt);
      await this.appendCommentary(matchId, match.ownerId, `${minute}' — ${commentary}`);
      this.gateway.server?.to(`match:${matchId}`).emit('ai:commentary', {
        matchId, minute, type: event.type, text: commentary,
      });
    } catch (err) {
      this.logger.warn(`AI commentary failed for ${event.type}: ${(err as Error).message}`);
    }
  }

  // ── Periodic rolling commentary ───────────────────────────────────────────

  /**
   * Called by VisionIngestService every ~15 match minutes.
   * Generates a tactical observation based on current stats.
   */
  async rollingCommentary(matchId: string): Promise<void> {
    const state = this.vision.getLiveState(matchId);
    if (!state) return;

    const minute = Math.floor(state.matchClock / 60);
    const last = this.lastCommentaryMinute.get(matchId) ?? -15;
    if (minute - last < 15) return;
    this.lastCommentaryMinute.set(matchId, minute);

    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) return;

    const total = state.possessionFrames.home + state.possessionFrames.away || 1;
    const homePoss = Math.round((state.possessionFrames.home / total) * 100);

    const prompt = `You are a football analyst commentating on a live match.
Match: ${match.homeTeam} vs ${match.awayTeam} (${match.competition ?? 'League match'})
Minute: ${minute}' | Half: ${state.half}
Score: ${match.homeScore}–${match.awayScore}
Possession: ${match.homeTeam} ${homePoss}% — ${match.awayTeam} ${100 - homePoss}%
xG: ${match.homeTeam} ${state.xg.home.toFixed(2)} — ${match.awayTeam} ${state.xg.away.toFixed(2)}
Formation: ${state.formations.home} vs ${state.formations.away}
Recent events: ${state.events.slice(-3).map((e) => `${e.minute}' ${e.type}`).join(', ') || 'none'}

Write ONE concise tactical observation (2–3 sentences). Focus on what's happening tactically right now.`;

    try {
      const text = await this.ai.complete(prompt);
      await this.appendCommentary(matchId, match.ownerId, `${minute}' — ${text}`);
      this.gateway.server?.to(`match:${matchId}`).emit('ai:commentary', {
        matchId, minute, type: 'TACTICAL', text,
      });
    } catch (err) {
      this.logger.warn(`Rolling commentary failed: ${(err as Error).message}`);
    }
  }

  // ── Half-time / full-time reports ─────────────────────────────────────────

  async generateHalfTimeReport(matchId: string): Promise<string> {
    return this.generateReport(matchId, 'half-time');
  }

  async generateFullTimeReport(matchId: string): Promise<string> {
    return this.generateReport(matchId, 'full-time');
  }

  private async generateReport(matchId: string, stage: 'half-time' | 'full-time'): Promise<string> {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) return '';

    const state = this.vision.getLiveState(matchId);
    const events = await this.eventRepo.find({ where: { matchId } });
    const total = (state?.possessionFrames.home ?? 0) + (state?.possessionFrames.away ?? 0) || 1;
    const homePoss = Math.round(((state?.possessionFrames.home ?? 0) / total) * 100);

    const goals = events.filter((e) => e.type === 'GOAL');
    const cards = events.filter((e) => ['YELLOW_CARD', 'RED_CARD'].includes(e.type));

    const prompt = `You are a professional football analyst writing a ${stage} tactical report.

Match: ${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam}
Competition: ${match.competition ?? 'League match'}
Stage: ${stage}
Possession: ${match.homeTeam} ${homePoss}% — ${match.awayTeam} ${100 - homePoss}%
xG: ${match.homeTeam} ${state?.xg.home.toFixed(2) ?? '0.00'} — ${match.awayTeam} ${state?.xg.away.toFixed(2) ?? '0.00'}
Formations: ${state?.formations.home ?? '?'} vs ${state?.formations.away ?? '?'}
Goals: ${goals.map((g) => `${g.minute}' ${g.team} (${g.playerName ?? 'unknown'})`).join(', ') || 'none'}
Cards: ${cards.map((c) => `${c.minute}' ${c.type} ${c.team}`).join(', ') || 'none'}

Write a structured ${stage} tactical report covering:
1. Tactical shape and pressing
2. Key moments and turning points
3. Individual performances
4. What to expect ${stage === 'half-time' ? 'in the second half' : 'going forward'}

Keep it under 250 words. Be specific and analytical.`;

    try {
      const report = await this.ai.complete(prompt);
      await this.saveReport(matchId, match.ownerId, report);
      this.gateway.server?.to(`match:${matchId}`).emit('ai:report', { matchId, stage, report });
      return report;
    } catch (err) {
      this.logger.warn(`${stage} report failed: ${(err as Error).message}`);
      return '';
    }
  }

  // ── Highlight markers ─────────────────────────────────────────────────────

  /**
   * Returns frame numbers of significant moments for highlight clip generation.
   * The Python pipeline can use these to cut video clips.
   */
  async getHighlightMarkers(matchId: string): Promise<Array<{
    frameNumber: number;
    matchClock: number;
    minute: number;
    type: string;
    team: string | null;
    description: string;
  }>> {
    const state = this.vision.getLiveState(matchId);
    const dbEvents = await this.eventRepo.find({ where: { matchId } });

    const highlightTypes = ['GOAL', 'PENALTY', 'RED_CARD', 'VAR', 'OWN_GOAL', 'OFFSIDE'];

    const visionMarkers = (state?.events ?? [])
      .filter((e) => highlightTypes.includes(e.type))
      .map((e) => ({
        frameNumber: e.frameNumber,
        matchClock: e.matchClock,
        minute: e.minute,
        type: e.type,
        team: e.team,
        description: `${e.minute}' ${e.type}${e.jerseyNumber ? ` #${e.jerseyNumber}` : ''}`,
      }));

    const dbMarkers = dbEvents
      .filter((e) => highlightTypes.includes(e.type))
      .map((e) => ({
        frameNumber: 0,
        matchClock: e.minute * 60,
        minute: e.minute,
        type: e.type,
        team: e.team ?? null,
        description: `${e.minute}' ${e.type} — ${e.playerName ?? e.team ?? ''}`,
      }));

    // Merge, deduplicate by minute+type
    const all = [...visionMarkers, ...dbMarkers];
    const seen = new Set<string>();
    return all.filter((m) => {
      const key = `${m.minute}_${m.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.matchClock - b.matchClock);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async appendCommentary(matchId: string, ownerId: string, text: string): Promise<void> {
    const existing = await this.analyticsRepo.findOne({ where: { matchId, ownerId } });
    if (existing) {
      const current = existing.aiCommentary ?? '';
      existing.aiCommentary = current ? `${current}\n${text}` : text;
      await this.analyticsRepo.save(existing);
    }
  }

  private async saveReport(matchId: string, ownerId: string, report: string): Promise<void> {
    const existing = await this.analyticsRepo.findOne({ where: { matchId, ownerId } });
    if (existing) {
      existing.aiTacticalReport = report;
      await this.analyticsRepo.save(existing);
    }
  }

  private buildEventPrompt(
    type: string,
    match: SportsMatch,
    minute: number,
    homePoss: number,
    context: Record<string, unknown>,
  ): string {
    const team = context['team'] === 'home' ? match.homeTeam : match.awayTeam;
    const jersey = context['jerseyNumber'] ? `#${context['jerseyNumber']}` : '';
    const score = `${match.homeScore}–${match.awayScore}`;

    const eventDesc: Record<string, string> = {
      GOAL: `GOAL! ${team} ${jersey} scores in the ${minute}th minute. Score: ${score}`,
      PENALTY: `PENALTY awarded to ${team} in the ${minute}th minute.`,
      RED_CARD: `RED CARD! ${team} ${jersey} is sent off in the ${minute}th minute.`,
      VAR: `VAR review in the ${minute}th minute.`,
      OWN_GOAL: `OWN GOAL by ${team} ${jersey} in the ${minute}th minute. Score: ${score}`,
    };

    return `You are a live football commentator. React to this event in 1–2 sentences with energy and insight.
Match: ${match.homeTeam} vs ${match.awayTeam} (${match.competition ?? 'League'})
Possession: ${match.homeTeam} ${homePoss}%
Event: ${eventDesc[type] ?? `${type} at ${minute}'`}
Write the commentary now:`;
  }
}
