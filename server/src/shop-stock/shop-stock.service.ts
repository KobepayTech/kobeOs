import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ShopStockAllocation,
  ShopStockEstimate,
  ShopStockReconciliation,
} from './shop-stock.entity';
import {
  AllocationQueryDto,
  CalculateEstimateDto,
  CreateAllocationDto,
  EstimateResult,
  ReconcileDto,
  ReconciliationResult,
  UpdateAllocationDto,
} from './dto/shop-stock.dto';

@Injectable()
export class ShopStockService {
  constructor(
    @InjectRepository(ShopStockAllocation)
    private readonly allocations: Repository<ShopStockAllocation>,
    @InjectRepository(ShopStockEstimate)
    private readonly estimates: Repository<ShopStockEstimate>,
    @InjectRepository(ShopStockReconciliation)
    private readonly reconciliations: Repository<ShopStockReconciliation>,
  ) {}

  // ── Allocations ──────────────────────────────────────────────────────────

  listAllocations(ownerId: string, query: AllocationQueryDto = {}) {
    const where: Record<string, unknown> = { ownerId };
    if (query.shopId) where['shopId'] = query.shopId;
    if (query.status) where['status'] = query.status;
    return this.allocations.find({
      where: where as any,
      order: { createdAt: 'DESC' },
    });
  }

  async getAllocation(ownerId: string, id: string) {
    const a = await this.allocations.findOne({ where: { id, ownerId } });
    if (!a) throw new NotFoundException('Allocation not found');
    return a;
  }

  async createAllocation(ownerId: string, dto: CreateAllocationDto) {
    const avgPieceValue = dto.totalPieces > 0
      ? dto.totalValue / dto.totalPieces
      : 0;

    const entity = this.allocations.create({
      ...dto,
      ownerId,
      averagePieceValue: avgPieceValue,
      status: 'OPEN',
    });
    return this.allocations.save(entity);
  }

  async updateAllocation(ownerId: string, id: string, dto: UpdateAllocationDto) {
    const existing = await this.getAllocation(ownerId, id);
    Object.assign(existing, dto);

    // Recalculate average when value or pieces change
    if (dto.totalValue !== undefined || dto.totalPieces !== undefined) {
      existing.averagePieceValue =
        existing.totalPieces > 0
          ? existing.totalValue / existing.totalPieces
          : 0;
    }
    return this.allocations.save(existing);
  }

  // ── Estimate calculation ─────────────────────────────────────────────────

  /**
   * Core estimation logic:
   *
   *   estimatedSoldPieces     = salesValue / averagePieceValue
   *   estimatedRemainingPieces = totalPieces - estimatedSoldPieces  (floor at 0)
   *   superProfit              = max(0, salesValue - totalValue)
   *
   * When salesValue exceeds totalValue the allocation is fully consumed and
   * the surplus is classified as super profit.
   */
  async calculateEstimate(
    ownerId: string,
    allocationId: string,
    dto: CalculateEstimateDto,
  ): Promise<EstimateResult> {
    const allocation = await this.getAllocation(ownerId, allocationId);

    if (allocation.averagePieceValue <= 0) {
      throw new BadRequestException(
        'Cannot estimate: allocation has zero average piece value',
      );
    }

    const salesValue = Number(dto.salesValue);
    const totalValue = Number(allocation.totalValue);
    const totalPieces = Number(allocation.totalPieces);
    const avgPieceValue = Number(allocation.averagePieceValue);

    const rawSoldPieces = salesValue / avgPieceValue;
    const estimatedSoldPieces = Math.min(rawSoldPieces, totalPieces);
    const estimatedRemainingPieces = Math.max(0, totalPieces - rawSoldPieces);
    const superProfit = Math.max(0, salesValue - totalValue);

    // Persist the latest estimate snapshot
    const snapshot = this.estimates.create({
      ownerId,
      allocationId,
      salesValue,
      estimatedSoldPieces,
      estimatedRemainingPieces,
      superProfit,
      accuracy: 'ESTIMATE',
    });
    await this.estimates.save(snapshot);

    return {
      allocationId,
      allocationNumber: allocation.allocationNumber,
      shopName: allocation.shopName ?? null,
      warehouseName: allocation.warehouseName ?? null,
      totalValue,
      totalPieces,
      averagePieceValue: avgPieceValue,
      currency: allocation.currency,
      salesValue,
      estimatedSoldPieces,
      estimatedRemainingPieces,
      superProfit,
      accuracy: 'ESTIMATE',
      status: allocation.status,
    };
  }

  /** Returns the most recent estimate snapshot for an allocation. */
  async getLatestEstimate(ownerId: string, allocationId: string) {
    await this.getAllocation(ownerId, allocationId); // ownership check
    return this.estimates.findOne({
      where: { ownerId, allocationId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Returns all estimate snapshots for an allocation (history). */
  async getEstimateHistory(ownerId: string, allocationId: string) {
    await this.getAllocation(ownerId, allocationId);
    return this.estimates.find({
      where: { ownerId, allocationId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Reconciliation ───────────────────────────────────────────────────────

  async reconcile(
    ownerId: string,
    allocationId: string,
    dto: ReconcileDto,
  ): Promise<ReconciliationResult> {
    const allocation = await this.getAllocation(ownerId, allocationId);

    // Derive estimated remaining from the latest estimate snapshot
    const latestEstimate = await this.estimates.findOne({
      where: { ownerId, allocationId },
      order: { createdAt: 'DESC' },
    });

    const estimatedPieces = latestEstimate
      ? Number(latestEstimate.estimatedRemainingPieces)
      : Number(allocation.totalPieces);

    const physicalCount = Number(dto.physicalCount);
    const variance = estimatedPieces - physicalCount;

    // Auto-classify variance type when not provided
    let varianceType = dto.varianceType;
    if (!varianceType) {
      if (variance > 0) varianceType = 'SHRINKAGE';
      else if (variance < 0) varianceType = 'SURPLUS';
      else varianceType = 'SHRINKAGE'; // zero variance — no loss
    }

    const record = this.reconciliations.create({
      ownerId,
      allocationId,
      estimatedPieces,
      physicalCount,
      variance,
      varianceType,
      notes: dto.notes ?? null,
    });
    await this.reconciliations.save(record);

    // Mark allocation as reconciled
    allocation.status = 'RECONCILED';
    await this.allocations.save(allocation);

    return {
      allocationId,
      estimatedPieces,
      physicalCount,
      variance,
      varianceType,
      notes: dto.notes ?? null,
    };
  }

  async getReconciliations(ownerId: string, allocationId: string) {
    await this.getAllocation(ownerId, allocationId);
    return this.reconciliations.find({
      where: { ownerId, allocationId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Summary report ───────────────────────────────────────────────────────

  /**
   * Aggregates all open allocations for the owner into a per-shop summary.
   * Useful for the "which shop is performing best / has losses" dashboard.
   */
  async shopSummary(ownerId: string) {
    const allocations = await this.allocations.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });

    const summaryMap = new Map<
      string,
      {
        shopId: string | null;
        shopName: string | null;
        totalAllocated: number;
        totalSales: number;
        estimatedRemaining: number;
        superProfit: number;
        allocationCount: number;
      }
    >();

    for (const alloc of allocations) {
      const key = alloc.shopId ?? alloc.shopName ?? 'unknown';
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          shopId: alloc.shopId ?? null,
          shopName: alloc.shopName ?? null,
          totalAllocated: 0,
          totalSales: 0,
          estimatedRemaining: 0,
          superProfit: 0,
          allocationCount: 0,
        });
      }
      const entry = summaryMap.get(key)!;
      entry.allocationCount += 1;
      entry.totalAllocated += Number(alloc.totalValue);

      const latest = await this.estimates.findOne({
        where: { ownerId, allocationId: alloc.id },
        order: { createdAt: 'DESC' },
      });
      if (latest) {
        entry.totalSales += Number(latest.salesValue);
        entry.estimatedRemaining += Number(latest.estimatedRemainingPieces);
        entry.superProfit += Number(latest.superProfit);
      }
    }

    return Array.from(summaryMap.values());
  }
}
