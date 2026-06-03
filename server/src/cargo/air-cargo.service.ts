import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CargoAirHub, CargoAirline, CargoAirRoutePlan } from './air-cargo.entity';
import { CargoAnalyticsSnapshot, CargoCustomsFlow, CargoLastMileDelivery, CargoOperationalAssessment, CargoTrackingEvent } from './air-cargo-ops.entity';
import { CreateAirHubDto, CreateAirlineDto, CreateRoutePlanDto } from './dto/air-route.dto';
import { CreateCustomsFlowDto, CreateLastMileDto, CreateTrackingEventDto, UpdateDeliveryProofDto } from './dto/air-ops.dto';

function num(v: unknown) { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; }
function code(prefix: string) { return `${prefix}-${Date.now().toString(36).toUpperCase()}`; }
function risk(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' { return score >= 85 ? 'CRITICAL' : score >= 65 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW'; }

@Injectable()
export class AirCargoService {
  constructor(
    @InjectRepository(CargoAirHub) private readonly hubs: Repository<CargoAirHub>,
    @InjectRepository(CargoAirline) private readonly airlines: Repository<CargoAirline>,
    @InjectRepository(CargoAirRoutePlan) private readonly routes: Repository<CargoAirRoutePlan>,
    @InjectRepository(CargoCustomsFlow) private readonly customs: Repository<CargoCustomsFlow>,
    @InjectRepository(CargoTrackingEvent) private readonly events: Repository<CargoTrackingEvent>,
    @InjectRepository(CargoOperationalAssessment) private readonly assessments: Repository<CargoOperationalAssessment>,
    @InjectRepository(CargoLastMileDelivery) private readonly deliveries: Repository<CargoLastMileDelivery>,
    @InjectRepository(CargoAnalyticsSnapshot) private readonly snapshots: Repository<CargoAnalyticsSnapshot>,
  ) {}

  createHub(ownerId: string, dto: CreateAirHubDto) { return this.hubs.save(this.hubs.create({ ...dto, ownerId, active: dto.active ?? true })); }
  listHubs(ownerId: string) { return this.hubs.find({ where: { ownerId }, order: { code: 'ASC' } }); }
  createAirline(ownerId: string, dto: CreateAirlineDto) { return this.airlines.save(this.airlines.create({ ...dto, ownerId, active: dto.active ?? true })); }
  listAirlines(ownerId: string) { return this.airlines.find({ where: { ownerId }, order: { reliabilityScore: 'DESC' } }); }

  async createRoute(ownerId: string, dto: CreateRoutePlanDto) {
    const hubs = await this.hubs.find({ where: { ownerId, active: true } });
    const airlines = await this.airlines.find({ where: { ownerId, active: true } });
    const priority = (dto.priority ?? 'STANDARD') as CargoAirRoutePlan['priority'];
    const selectedHubCodes = this.selectHubs(priority, hubs);
    const selectedAirline = airlines.sort((a, b) => (num(b.reliabilityScore) - num(a.reliabilityScore)) || (num(a.pricePerKg) - num(b.pricePerKg)))[0];
    const customsDelay = num(dto.customsDelayHours ?? (priority === 'EXPRESS' ? 4 : 12));
    const transitDelay = num(dto.transitDelayHours ?? selectedHubCodes.length * 4);
    const flightHours = num(dto.estimatedFlightHours ?? (priority === 'EXPRESS' ? 10 : 16));
    const deliveryHours = num(dto.deliveryHours ?? 12);
    const etaHours = flightHours + customsDelay + transitDelay + deliveryHours;
    const riskScore = this.scoreRisk(priority, selectedHubCodes.length, customsDelay, selectedAirline?.reliabilityScore ?? 80, dto.cargoType ?? 'general');
    const route = this.routes.create({
      ownerId,
      routeCode: dto.routeCode ?? code('AIR'),
      shipmentId: dto.shipmentId ?? null,
      priority,
      origin: dto.origin,
      destination: dto.destination,
      cargoType: dto.cargoType ?? 'general',
      weightKg: dto.weightKg ?? 0,
      hubs: selectedHubCodes,
      routeSteps: this.steps(priority, selectedHubCodes),
      selectedAirline: dto.selectedAirline ?? selectedAirline?.code ?? '',
      selectedFlightNumber: dto.selectedFlightNumber ?? '',
      estimatedFlightHours: flightHours,
      customsDelayHours: customsDelay,
      transitDelayHours: transitDelay,
      deliveryHours,
      etaHours,
      estimatedArrivalAt: new Date(Date.now() + etaHours * 60 * 60 * 1000),
      riskLevel: risk(riskScore),
      riskReasons: this.riskReasons(riskScore, customsDelay, selectedHubCodes.length, selectedAirline?.reliabilityScore ?? 80),
      status: (dto.status ?? 'PLANNED') as CargoAirRoutePlan['status'],
      decisionReason: this.decision(priority, selectedHubCodes, selectedAirline?.name),
      notes: dto.notes ?? '',
    });
    const saved = await this.routes.save(route);
    await this.assess(saved.ownerId, saved.id);
    return saved;
  }

  listRoutes(ownerId: string) { return this.routes.find({ where: { ownerId }, order: { createdAt: 'DESC' } }); }
  async getRoute(ownerId: string, id: string) { const r = await this.routes.findOne({ where: { ownerId, id } }); if (!r) throw new NotFoundException('Route plan not found'); return r; }

  async reroute(ownerId: string, id: string) {
    const current = await this.getRoute(ownerId, id);
    current.status = 'REROUTED';
    current.hubs = [...new Set([...current.hubs, 'ALT-HUB'])];
    current.transitDelayHours = num(current.transitDelayHours) + 2;
    current.etaHours = num(current.estimatedFlightHours) + num(current.customsDelayHours) + num(current.transitDelayHours) + num(current.deliveryHours);
    current.estimatedArrivalAt = new Date(Date.now() + current.etaHours * 60 * 60 * 1000);
    current.decisionReason = `${current.decisionReason} | Rerouted by operations engine`;
    return this.routes.save(current);
  }

  createCustoms(ownerId: string, dto: CreateCustomsFlowDto) { return this.customs.save(this.customs.create({ ...dto, ownerId, shipmentId: dto.shipmentId ?? null, parcelId: dto.parcelId ?? null, status: (dto.status ?? 'PENDING') as any, clearedAt: dto.clearedAt ? new Date(dto.clearedAt) : null })); }
  listCustoms(ownerId: string) { return this.customs.find({ where: { ownerId }, order: { createdAt: 'DESC' } }); }
  createEvent(ownerId: string, dto: CreateTrackingEventDto) { return this.events.save(this.events.create({ ...dto, ownerId, shipmentId: dto.shipmentId ?? null, parcelId: dto.parcelId ?? null, location: dto.location ?? '', flightNumber: dto.flightNumber ?? '', eventAt: dto.eventAt ? new Date(dto.eventAt) : new Date(), metadata: {}, notes: dto.notes ?? '' })); }
  listEvents(ownerId: string, shipmentId?: string) { return this.events.find({ where: shipmentId ? { ownerId, shipmentId } : { ownerId }, order: { eventAt: 'DESC' } }); }
  createDelivery(ownerId: string, dto: CreateLastMileDto) { return this.deliveries.save(this.deliveries.create({ ...dto, ownerId, shipmentId: dto.shipmentId ?? null, parcelId: dto.parcelId ?? null, driverId: dto.driverId ?? null, otpCode: dto.otpCode ?? String(Math.floor(100000 + Math.random() * 899999)), status: (dto.status ?? 'PENDING') as any })); }
  listDeliveries(ownerId: string) { return this.deliveries.find({ where: { ownerId }, order: { createdAt: 'DESC' } }); }

  async proof(ownerId: string, id: string, dto: UpdateDeliveryProofDto) {
    const row = await this.deliveries.findOne({ where: { ownerId, id } });
    if (!row) throw new NotFoundException('Delivery not found');
    if (dto.otpCode && dto.otpCode === row.otpCode) row.otpVerified = true;
    if (dto.status) row.status = dto.status as any;
    if (dto.proofPhotoUrl) row.proofPhotoUrl = dto.proofPhotoUrl;
    if (dto.signatureUrl) row.signatureUrl = dto.signatureUrl;
    if (dto.failureReason) row.failureReason = dto.failureReason;
    if (row.status === 'DELIVERED') row.deliveredAt = new Date();
    return this.deliveries.save(row);
  }

  async assess(ownerId: string, routePlanId: string) {
    const route = await this.getRoute(ownerId, routePlanId);
    const score = this.scoreRisk(route.priority, route.hubs.length, route.customsDelayHours, 80, route.cargoType);
    const row = this.assessments.create({ ownerId, routePlanId, shipmentId: route.shipmentId ?? null, riskLevel: risk(score), riskScore: score, findings: this.riskReasons(score, route.customsDelayHours, route.hubs.length, 80), recommendedActions: score > 65 ? ['Review route', 'Prepare alternate hub', 'Notify operations'] : ['Monitor normally'], rerouteRecommended: score > 75, notes: '' });
    return this.assessments.save(row);
  }

  async analytics(ownerId: string, period = new Date().toISOString().slice(0, 7)) {
    const [routes, customs, deliveries, airlines] = await Promise.all([this.routes.find({ where: { ownerId } }), this.customs.find({ where: { ownerId } }), this.deliveries.find({ where: { ownerId } }), this.airlines.find({ where: { ownerId } })]);
    const cargoVolumeKg = routes.reduce((s, r) => s + num(r.weightKg), 0);
    const customsDelayHours = customs.reduce((s, c) => s + num(c.delayHours), 0);
    const averageTransitHours = routes.length ? routes.reduce((s, r) => s + num(r.etaHours), 0) / routes.length : 0;
    const delivered = deliveries.filter((d) => d.status === 'DELIVERED').length;
    const snapshot = this.snapshots.create({ ownerId, period, flightUtilization: cargoVolumeKg ? Math.min(100, cargoVolumeKg / 1000 * 100) : 0, cargoVolumeKg, averageTransitHours, customsDelayHours, routeProfitability: delivered * 100, airlinePerformance: Object.fromEntries(airlines.map((a) => [a.code, { reliabilityScore: a.reliabilityScore, averageDelayHours: a.averageDelayHours }])), delayHeatmap: { customsDelayHours, routeCount: routes.length }, airportEfficiency: { delivered, pendingDeliveries: deliveries.length - delivered } });
    return this.snapshots.save(snapshot);
  }

  private selectHubs(priority: string, hubs: CargoAirHub[]) { if (priority === 'EXPRESS') return hubs.filter((h) => h.type === 'EXPRESS').slice(0, 1).map((h) => h.code); if (priority === 'SMART_MULTI_HUB') return hubs.slice(0, 3).map((h) => h.code); return hubs.filter((h) => ['CUSTOMS', 'PRIMARY'].includes(h.type)).slice(0, 2).map((h) => h.code); }
  private steps(priority: string, hubs: string[]) { return ['Supplier', priority === 'EXPRESS' ? 'Priority Warehouse Lane' : 'China Warehouse', 'Export Customs', 'Airport Loading', 'International Flight', ...hubs.map((h) => `Transit Hub ${h}`), 'Tanzania Customs', 'Dar Warehouse', 'Regional Distribution', 'Customer Delivery']; }
  private scoreRisk(priority: string, hubs: number, customsDelay: number, reliability: number, cargoType: string) { return Math.min(100, (priority === 'SMART_MULTI_HUB' ? 15 : 5) + hubs * 7 + customsDelay * 2 + Math.max(0, 100 - reliability) + (['fragile', 'medical', 'perishable'].includes(cargoType.toLowerCase()) ? 15 : 0)); }
  private riskReasons(score: number, customsDelay: number, hubs: number, reliability: number) { const out: string[] = []; if (customsDelay > 12) out.push('Customs delay above normal'); if (hubs > 2) out.push('Multiple hub handling'); if (reliability < 75) out.push('Airline reliability below target'); if (score > 65) out.push('Operations review recommended'); return out; }
  private decision(priority: string, hubs: string[], airline?: string) { return `${priority} route selected with ${hubs.length} hub(s)${airline ? ` using ${airline}` : ''}.`; }
}
