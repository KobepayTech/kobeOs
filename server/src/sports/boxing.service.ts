import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoxingFighter, BoxingBout, RoundScore, BoutMethod } from './boxing.entity';

const KO_METHODS: BoutMethod[] = ['KO', 'TKO', 'RTD', 'DQ'];

@Injectable()
export class BoxingService {
  constructor(
    @InjectRepository(BoxingFighter) private readonly fighters: Repository<BoxingFighter>,
    @InjectRepository(BoxingBout) private readonly bouts: Repository<BoxingBout>,
  ) {}

  /* ── Fighters ── */
  listFighters(uid: string) {
    return this.fighters.find({ where: { ownerId: uid }, order: { ranking: 'ASC', name: 'ASC' }, take: 500 });
  }
  createFighter(uid: string, dto: Partial<BoxingFighter>) {
    if (!dto.name?.trim()) throw new BadRequestException('Fighter name is required');
    return this.fighters.save(this.fighters.create({ ...dto, ownerId: uid }));
  }
  async updateFighter(uid: string, id: string, dto: Partial<BoxingFighter>) {
    const f = await this.fighters.findOne({ where: { ownerId: uid, id } });
    if (!f) throw new NotFoundException('Fighter not found');
    Object.assign(f, dto);
    return this.fighters.save(f);
  }
  async removeFighter(uid: string, id: string) {
    const f = await this.fighters.findOne({ where: { ownerId: uid, id } });
    if (!f) throw new NotFoundException();
    await this.fighters.remove(f);
    return { removed: true };
  }

  /* ── Bouts / fight card ── */
  async listBouts(uid: string, opts: { event?: string; status?: string } = {}) {
    const qb = this.bouts.createQueryBuilder('b').where('b.ownerId = :uid', { uid }).take(500);
    if (opts.event) qb.andWhere('b.eventName = :e', { e: opts.event });
    if (opts.status) qb.andWhere('b.status = :s', { s: opts.status });
    // Main event first, then co-main, then undercard; newest first within.
    qb.orderBy(`CASE b.cardPosition WHEN 'MAIN' THEN 0 WHEN 'CO_MAIN' THEN 1 ELSE 2 END`, 'ASC').addOrderBy('b.createdAt', 'DESC');
    return qb.getMany();
  }

  async createBout(uid: string, dto: Partial<BoxingBout> & { fighterAId: string; fighterBId: string }) {
    const a = await this.fighters.findOne({ where: { ownerId: uid, id: dto.fighterAId } });
    const b = await this.fighters.findOne({ where: { ownerId: uid, id: dto.fighterBId } });
    if (!a || !b) throw new BadRequestException('Both fighters must exist');
    if (a.id === b.id) throw new BadRequestException('A fighter cannot face themselves');
    return this.bouts.save(this.bouts.create({
      ownerId: uid,
      eventName: dto.eventName ?? '', date: dto.date ?? null, venue: dto.venue ?? '',
      fighterAId: a.id, fighterAName: a.name, fighterBId: b.id, fighterBName: b.name,
      weightClass: dto.weightClass ?? a.weightClass ?? '', title: dto.title ?? '',
      scheduledRounds: dto.scheduledRounds ?? 12, cardPosition: dto.cardPosition ?? 'UNDERCARD',
      status: 'SCHEDULED', roundScores: [],
      judges: dto.judges ?? ['Judge 1', 'Judge 2', 'Judge 3'],
    }));
  }

  async getBout(uid: string, id: string) {
    const b = await this.bouts.findOne({ where: { ownerId: uid, id } });
    if (!b) throw new NotFoundException('Bout not found');
    return this.withTally(b);
  }

  /** Public, read-only bout state for the broadcast overlay (no owner scope
   *  — the bout id is the key). Includes both fighters' records for the card. */
  async publicBout(id: string) {
    const b = await this.bouts.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Bout not found');
    const [a, bb] = await Promise.all([
      this.fighters.findOne({ where: { id: b.fighterAId } }),
      this.fighters.findOne({ where: { id: b.fighterBId } }),
    ]);
    const rec = (f: BoxingFighter | null) => (f ? { wins: f.wins, losses: f.losses, draws: f.draws, kos: f.kos, country: f.country, nickname: f.nickname } : null);
    return { ...this.withTally(b), fighterA: rec(a), fighterB: rec(bb) };
  }

  async updateBout(uid: string, id: string, dto: Partial<BoxingBout>) {
    const b = await this.bouts.findOne({ where: { ownerId: uid, id } });
    if (!b) throw new NotFoundException();
    // Don't let arbitrary updates clobber fighters/result via this path.
    const { fighterAId, fighterBId, roundScores, method, winnerId, ...safe } = dto as Record<string, unknown>;
    void fighterAId; void fighterBId; void roundScores; void method; void winnerId;
    Object.assign(b, safe);
    return this.bouts.save(b);
  }

  async removeBout(uid: string, id: string) {
    const b = await this.bouts.findOne({ where: { ownerId: uid, id } });
    if (!b) throw new NotFoundException();
    await this.bouts.remove(b);
    return { removed: true };
  }

  /* ── Live scoring ── */

  /** Record (or overwrite) a judge's score for a round. Marks the bout LIVE. */
  async scoreRound(uid: string, id: string, dto: { round: number; judge: string; a: number; b: number }) {
    const b = await this.bouts.findOne({ where: { ownerId: uid, id } });
    if (!b) throw new NotFoundException('Bout not found');
    if (b.status === 'FINISHED') throw new BadRequestException('Bout already finished');
    const round = Math.max(1, Math.round(dto.round));
    if (round > b.scheduledRounds) throw new BadRequestException(`Only ${b.scheduledRounds} rounds scheduled`);
    const judge = dto.judge?.trim() || b.judges[0] || 'Judge 1';
    const scores: RoundScore[] = (b.roundScores ?? []).filter((s) => !(s.round === round && s.judge === judge));
    scores.push({ round, judge, a: Math.max(0, Math.round(dto.a)), b: Math.max(0, Math.round(dto.b)) });
    b.roundScores = scores;
    b.status = 'LIVE';
    b.currentRound = Math.max(b.currentRound, round);
    await this.bouts.save(b);
    return this.withTally(b);
  }

  /** Finish the bout, set the result, and update both fighters' records. */
  async finish(uid: string, id: string, dto: { method: BoutMethod; winnerId?: string | null; endRound?: number }) {
    const b = await this.bouts.findOne({ where: { ownerId: uid, id } });
    if (!b) throw new NotFoundException('Bout not found');
    if (b.status === 'FINISHED') throw new BadRequestException('Already finished');
    if (!dto.method) throw new BadRequestException('Result method is required');

    const isDraw = dto.method === 'DRAW' || dto.method === 'NC';
    let winnerId = dto.winnerId ?? null;
    if (!isDraw && !winnerId) {
      // Derive winner from the scorecards for decision results.
      const t = this.tally(b);
      winnerId = t.leader === 'A' ? b.fighterAId : t.leader === 'B' ? b.fighterBId : null;
      if (!winnerId) throw new BadRequestException('Pick a winner');
    }

    b.status = 'FINISHED';
    b.method = dto.method;
    b.winnerId = winnerId;
    b.endRound = dto.endRound ?? (b.currentRound || b.scheduledRounds);
    await this.bouts.save(b);

    // Update records.
    const [a, bb] = await Promise.all([
      this.fighters.findOne({ where: { ownerId: uid, id: b.fighterAId } }),
      this.fighters.findOne({ where: { ownerId: uid, id: b.fighterBId } }),
    ]);
    if (a && bb) {
      if (isDraw) { a.draws++; bb.draws++; }
      else {
        const winner = winnerId === a.id ? a : bb;
        const loser = winnerId === a.id ? bb : a;
        winner.wins++; loser.losses++;
        if (KO_METHODS.includes(dto.method)) winner.kos++;
      }
      await this.fighters.save([a, bb]);
    }
    return this.withTally(b);
  }

  /* ── Scorecard tally ── */
  private tally(b: BoxingBout) {
    const perJudge = b.judges.map((judge) => {
      const rows = (b.roundScores ?? []).filter((s) => s.judge === judge);
      const a = rows.reduce((s, r) => s + r.a, 0);
      const bt = rows.reduce((s, r) => s + r.b, 0);
      return { judge, a, bt, rounds: rows.length, lead: a > bt ? 'A' : bt > a ? 'B' : 'EVEN' };
    });
    const aCards = perJudge.filter((j) => j.lead === 'A').length;
    const bCards = perJudge.filter((j) => j.lead === 'B').length;
    const leader = aCards > bCards ? 'A' : bCards > aCards ? 'B' : 'EVEN';
    return { perJudge, aCards, bCards, leader };
  }
  private withTally(b: BoxingBout) {
    return { ...b, tally: this.tally(b) };
  }
}
