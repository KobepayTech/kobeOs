import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeMessage, DisputeStatus, DisputeType } from './dispute.entity';

export interface OpenDisputeDto {
  againstUserId: string;
  campaignId?: string;
  escrowId?: string;
  txnReference?: string;
  type: DisputeType;
  description: string;
  evidence?: string[];
}

export interface AddMessageDto {
  message: string;
  attachments?: string[];
}

export interface ResolveDisputeDto {
  status: 'resolved_creator' | 'resolved_brand' | 'resolved_split' | 'closed';
  resolution: string;
  refundAmountTzs?: number;
  releaseAmountTzs?: number;
}

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute) private readonly repo: Repository<Dispute>,
  ) {}

  async open(uid: string, dto: OpenDisputeDto): Promise<Dispute> {
    const dispute = this.repo.create({
      raisedBy: uid,
      againstUserId: dto.againstUserId,
      campaignId: dto.campaignId ?? null,
      escrowId: dto.escrowId ?? null,
      txnReference: dto.txnReference ?? null,
      type: dto.type,
      status: 'open',
      description: dto.description,
      evidence: dto.evidence ?? [],
      messages: [],
      resolution: '',
      refundAmountTzs: 0,
      releaseAmountTzs: 0,
    });
    return this.repo.save(dispute);
  }

  async addMessage(uid: string, id: string, role: string, dto: AddMessageDto): Promise<Dispute> {
    const dispute = await this.getOne(id);
    // Only parties or admin can message
    if (dispute.raisedBy !== uid && dispute.againstUserId !== uid && role !== 'Admin') {
      throw new ForbiddenException('Not a party to this dispute');
    }
    const msg: DisputeMessage = {
      authorId: uid,
      authorRole: role,
      message: dto.message,
      attachments: dto.attachments ?? [],
      sentAt: new Date().toISOString(),
    };
    dispute.messages = [...dispute.messages, msg];
    if (dispute.status === 'open') dispute.status = 'under_review';
    return this.repo.save(dispute);
  }

  async resolve(adminId: string, id: string, dto: ResolveDisputeDto): Promise<Dispute> {
    const dispute = await this.getOne(id);
    dispute.status = dto.status as DisputeStatus;
    dispute.resolution = dto.resolution;
    dispute.refundAmountTzs = dto.refundAmountTzs ?? 0;
    dispute.releaseAmountTzs = dto.releaseAmountTzs ?? 0;
    dispute.resolvedAt = new Date();
    dispute.assignedTo = adminId;
    return this.repo.save(dispute);
  }

  async assign(adminId: string, id: string): Promise<Dispute> {
    const dispute = await this.getOne(id);
    dispute.assignedTo = adminId;
    dispute.status = 'under_review';
    return this.repo.save(dispute);
  }

  listMine(uid: string): Promise<Dispute[]> {
    return this.repo
      .createQueryBuilder('d')
      .where('d.raisedBy = :uid OR d.againstUserId = :uid', { uid })
      .orderBy('d.createdAt', 'DESC')
      .getMany();
  }

  listAll(status?: DisputeStatus): Promise<Dispute[]> {
    const qb = this.repo.createQueryBuilder('d').orderBy('d.createdAt', 'DESC');
    if (status) qb.where('d.status = :status', { status });
    return qb.getMany();
  }

  async getOne(id: string): Promise<Dispute> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Dispute not found');
    return d;
  }
}
