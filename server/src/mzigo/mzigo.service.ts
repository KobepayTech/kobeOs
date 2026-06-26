import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { MzigoAgent, MzigoCompany, MzigoParcel, MzigoTruckManifest } from './mzigo.entity';
import { BeemService } from '../notifications/beem.service';

const ALPHA = 'ACDEFGHJKMNPQRSTUVWXYZ23456789';
const genWaybill = (): string => {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHA[crypto.randomInt(0, ALPHA.length)];
  return 'KM-' + s;
};

/**
 * Kobe Mzigo — TZ ground-cargo flow with 4 roles:
 *   packager → agent → warehouse → destination
 *
 * Notification fan-out: at REGISTERED the chosen agent gets a
 * "new pickup waiting" SMS; at DELIVERED_DEST every parcel on the
 * truck triggers a "come pick up your goods" SMS to its owner +
 * recipient.
 */
@Injectable()
export class MzigoService {
  private readonly logger = new Logger(MzigoService.name);

  constructor(
    @InjectRepository(MzigoCompany)        private readonly companies: Repository<MzigoCompany>,
    @InjectRepository(MzigoAgent)          private readonly agents:    Repository<MzigoAgent>,
    @InjectRepository(MzigoParcel)         private readonly parcels:   Repository<MzigoParcel>,
    @InjectRepository(MzigoTruckManifest)  private readonly trucks:    Repository<MzigoTruckManifest>,
    private readonly beem: BeemService,
  ) {}

  // ── Companies + Agents (public read for the picker) ────────────

  listCompanies() {
    return this.companies.find({ where: { active: true }, order: { name: 'ASC' } });
  }

  async createCompany(dto: { name: string; phone?: string; headOffice?: string }) {
    if (!dto.name?.trim()) throw new BadRequestException('Company name is required');
    return this.companies.save(this.companies.create({
      name: dto.name.trim(),
      phone: dto.phone ?? '',
      headOffice: dto.headOffice ?? '',
      active: true,
      rating: 5,
    }));
  }

  async listAgents(companyId?: string) {
    if (companyId) {
      return this.agents.find({ where: { companyId, active: true }, order: { name: 'ASC' } });
    }
    return this.agents.find({ where: { active: true }, order: { companyName: 'ASC', name: 'ASC' } });
  }

  async createAgent(dto: { companyId: string; name: string; phone: string; area?: string }) {
    if (!dto.companyId || !dto.name?.trim() || !dto.phone?.trim()) {
      throw new BadRequestException('companyId, name, phone are required');
    }
    const company = await this.companies.findOne({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException('Company not found');
    return this.agents.save(this.agents.create({
      companyId: company.id,
      companyName: company.name,
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      area: dto.area ?? '',
      active: true,
      rating: 5,
      commissionPoints: 0,
    }));
  }

  // ── Parcels — the 4-role flow ──────────────────────────────────

  /** Role 1 — packager fills the form. Optionally picks an agent
   *  inline; if no agent is set yet, status stays REGISTERED and
   *  the parcel shows up in the agent-pool list for any agent to
   *  claim. */
  async register(dto: {
    packagerName: string; packagerPhone: string;
    ownerName: string; ownerPhone: string;
    ownerEmergencyName?: string; ownerEmergencyPhone?: string;
    recipientName: string; recipientPhone: string;
    recipientEmergencyPhone?: string;
    origin: string; destination: string;
    goodsType?: string; weightKg?: number;
    declaredValue?: number; paymentAmount?: number;
    agentId?: string;     // optional — packager may pre-pick
    notes?: string;
  }): Promise<MzigoParcel> {
    const required = ['packagerName', 'packagerPhone', 'ownerName', 'ownerPhone', 'recipientName', 'recipientPhone', 'origin', 'destination'] as const;
    for (const k of required) if (!String((dto as Record<string, unknown>)[k] ?? '').trim()) {
      throw new BadRequestException(`${k} is required`);
    }

    let agent: MzigoAgent | null = null;
    let companyId: string | null = null;
    let companyName = '';
    let agentName = '';
    let initialStatus: MzigoParcel['status'] = 'REGISTERED';
    if (dto.agentId) {
      agent = await this.agents.findOne({ where: { id: dto.agentId } });
      if (!agent) throw new NotFoundException('Agent not found');
      companyId = agent.companyId;
      companyName = agent.companyName;
      agentName = agent.name;
      initialStatus = 'AGENT_SELECTED';
    }

    const waybill = await this.nextWaybill();
    const parcel = await this.parcels.save(this.parcels.create({
      waybill,
      packagerName: dto.packagerName.trim(),
      packagerPhone: dto.packagerPhone.trim(),
      ownerName: dto.ownerName.trim(),
      ownerPhone: dto.ownerPhone.trim(),
      ownerEmergencyName: dto.ownerEmergencyName ?? '',
      ownerEmergencyPhone: dto.ownerEmergencyPhone ?? '',
      recipientName: dto.recipientName.trim(),
      recipientPhone: dto.recipientPhone.trim(),
      recipientEmergencyPhone: dto.recipientEmergencyPhone ?? '',
      origin: dto.origin.trim(),
      destination: dto.destination.trim(),
      goodsType: dto.goodsType ?? '',
      weightKg: dto.weightKg ?? 0,
      declaredValue: dto.declaredValue ?? 0,
      paymentAmount: dto.paymentAmount ?? 0,
      companyId,
      companyName,
      agentId: agent?.id ?? null,
      agentName,
      status: initialStatus,
      notes: dto.notes ?? '',
    }));

    // Notify the agent (if assigned) that a pickup is waiting.
    if (agent?.phone) {
      void this.beem.sendSms(
        agent.phone,
        `KobeMzigo: New pickup ${parcel.waybill} from ${parcel.packagerName} (${parcel.packagerPhone}). ${parcel.origin} → ${parcel.destination}.`,
      );
    }
    return parcel;
  }

  /** Role 2 — agent claims an unassigned parcel. */
  async claimParcel(waybill: string, agentId: string): Promise<MzigoParcel> {
    const agent = await this.agents.findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const parcel = await this.parcels.findOne({ where: { waybill } });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (parcel.status !== 'REGISTERED' && parcel.status !== 'AGENT_SELECTED') {
      throw new BadRequestException(`Parcel is ${parcel.status} — too late to claim`);
    }
    parcel.companyId = agent.companyId;
    parcel.companyName = agent.companyName;
    parcel.agentId = agent.id;
    parcel.agentName = agent.name;
    parcel.status = 'AGENT_SELECTED';
    return this.parcels.save(parcel);
  }

  /** Role 2 — agent confirms physical pickup. Commission point. */
  async markPickedUp(waybill: string, agentId: string): Promise<MzigoParcel> {
    const parcel = await this.parcels.findOne({ where: { waybill } });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (parcel.agentId !== agentId) throw new BadRequestException('You did not claim this parcel');
    if (parcel.status !== 'AGENT_SELECTED') throw new BadRequestException(`Parcel is ${parcel.status}`);
    parcel.status = 'PICKED_UP';
    parcel.pickedUpAt = new Date();
    await this.parcels.save(parcel);
    // Award the commission point.
    await this.agents.increment({ id: agentId }, 'commissionPoints', 1);
    // Notify the owner.
    if (parcel.ownerPhone) {
      void this.beem.sendSms(
        parcel.ownerPhone,
        `KobeMzigo: ${parcel.agentName} has picked up your parcel ${parcel.waybill}. Track at app.kobeapptz.com/mzigo/track/${parcel.waybill}.`,
      );
    }
    return parcel;
  }

  /** Role 3 — warehouse receives. */
  async markAtWarehouse(waybill: string): Promise<MzigoParcel> {
    const parcel = await this.parcels.findOne({ where: { waybill } });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (parcel.status !== 'PICKED_UP') throw new BadRequestException(`Parcel is ${parcel.status}`);
    parcel.status = 'AT_WAREHOUSE';
    parcel.atWarehouseAt = new Date();
    return this.parcels.save(parcel);
  }

  /** Role 3 — warehouse loads a batch of parcels onto a truck. */
  async loadOntoTruck(
    ownerId: string,
    dto: {
      waybills: string[]; truckPlate: string; driverName: string; driverPhone: string;
      origin: string; destination: string;
    },
  ): Promise<{ manifest: MzigoTruckManifest; parcels: MzigoParcel[] }> {
    if (!dto.waybills?.length) throw new BadRequestException('No waybills to load');
    if (!dto.truckPlate?.trim() || !dto.driverName?.trim()) {
      throw new BadRequestException('truckPlate + driverName required');
    }
    const truckPlate = dto.truckPlate.trim().toUpperCase().replace(/\s+/g, '');
    const parcels = await this.parcels.find({ where: { waybill: In(dto.waybills) } });
    if (parcels.length === 0) throw new NotFoundException('No parcels found for those waybills');
    const wrong = parcels.filter((p) => p.status !== 'AT_WAREHOUSE');
    if (wrong.length) {
      throw new BadRequestException(`Some parcels not yet at warehouse: ${wrong.map((p) => p.waybill).join(', ')}`);
    }
    const now = new Date();
    for (const p of parcels) {
      p.status = 'ON_TRUCK';
      p.onTruckAt = now;
      p.truckPlate = truckPlate;
      p.driverName = dto.driverName.trim();
      p.driverPhone = dto.driverPhone?.trim() ?? '';
    }
    await this.parcels.save(parcels);
    const manifest = await this.trucks.save(this.trucks.create({
      ownerId,
      truckPlate,
      driverName: dto.driverName.trim(),
      driverPhone: dto.driverPhone?.trim() ?? '',
      origin: dto.origin,
      destination: dto.destination,
      parcelCount: parcels.length,
      totalWeightKg: parseFloat(parcels.reduce((s, p) => s + Number(p.weightKg), 0).toFixed(2)),
      status: 'LOADING',
    }));
    return { manifest, parcels };
  }

  /** Role 3 — driver leaves the warehouse. Marks the manifest +
   *  all its parcels IN_TRANSIT. */
  async dispatchTruck(truckPlate: string): Promise<MzigoTruckManifest> {
    const plate = truckPlate.toUpperCase().replace(/\s+/g, '');
    const manifest = await this.findActiveTruck(plate);
    if (!manifest) throw new NotFoundException('No active manifest for that plate');
    if (manifest.status !== 'LOADING') throw new BadRequestException(`Truck is ${manifest.status}`);
    manifest.status = 'IN_TRANSIT';
    manifest.departedAt = new Date();
    await this.trucks.save(manifest);
    await this.parcels.update(
      { truckPlate: plate, status: 'ON_TRUCK' },
      { status: 'IN_TRANSIT', inTransitAt: new Date() },
    );
    return manifest;
  }

  /** Role 4 — destination scans the truck plate. Loads the truck's
   *  full manifest, marks every parcel DELIVERED_DEST, and fans out
   *  pickup SMS to every owner + recipient. */
  async receiveTruck(truckPlate: string): Promise<{ manifest: MzigoTruckManifest; parcels: MzigoParcel[] }> {
    const plate = truckPlate.toUpperCase().replace(/\s+/g, '');
    const manifest = await this.findActiveTruck(plate);
    if (!manifest) throw new NotFoundException('No active manifest for that plate');
    const parcels = await this.parcels.find({ where: { truckPlate: plate, status: In(['ON_TRUCK', 'IN_TRANSIT']) } });
    const now = new Date();
    for (const p of parcels) {
      p.status = 'DELIVERED_DEST';
      p.deliveredAt = now;
    }
    await this.parcels.save(parcels);
    manifest.status = 'DELIVERED';
    manifest.arrivedAt = now;
    await this.trucks.save(manifest);

    // Pickup-notification fan-out. Owners get the heads-up; the
    // physical recipient gets a separate "come and collect" so a
    // remote owner can stay out of the loop.
    await Promise.allSettled(parcels.flatMap((p) => {
      const lines = [
        p.ownerPhone &&
          this.beem.sendSms(p.ownerPhone, `KobeMzigo: Your parcel ${p.waybill} has arrived in ${manifest.destination}. ${p.recipientName} can collect from the cargo office.`),
        p.recipientPhone &&
          this.beem.sendSms(p.recipientPhone, `KobeMzigo: Parcel ${p.waybill} (${p.goodsType || 'goods'}) from ${p.packagerName} has arrived. Show this code at the ${manifest.destination} cargo office to collect.`),
      ].filter(Boolean) as Array<Promise<unknown>>;
      return lines;
    }));

    return { manifest, parcels };
  }

  /** Final step — recipient comes and collects. Marks COLLECTED. */
  async markCollected(waybill: string, collectedByName?: string): Promise<MzigoParcel> {
    const parcel = await this.parcels.findOne({ where: { waybill } });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (parcel.status !== 'DELIVERED_DEST') throw new BadRequestException(`Parcel is ${parcel.status}`);
    parcel.status = 'COLLECTED';
    parcel.collectedAt = new Date();
    if (collectedByName) parcel.notes = (parcel.notes ? parcel.notes + '\n' : '') + `Collected by: ${collectedByName}`;
    return this.parcels.save(parcel);
  }

  // ── Read endpoints powering the UI ─────────────────────────────

  /** Public tracking — anyone with the waybill number can see
   *  status + minimal metadata (no PII beyond what the customer
   *  already knew when registering). */
  async track(waybill: string): Promise<MzigoParcel> {
    const p = await this.parcels.findOne({ where: { waybill } });
    if (!p) throw new NotFoundException('Parcel not found');
    return p;
  }

  /** Pool of unassigned parcels — any agent can claim. */
  listOpenForAgent() {
    return this.parcels.find({ where: { status: 'REGISTERED' }, order: { createdAt: 'DESC' }, take: 100 });
  }

  /** Parcels currently picked up by a specific agent. */
  listMyAssignments(agentId: string) {
    return this.parcels.find({
      where: { agentId, status: In(['AGENT_SELECTED', 'PICKED_UP']) },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /** Warehouse queue — picked up but not yet on a truck. */
  listAtWarehouse() {
    return this.parcels.find({ where: { status: In(['PICKED_UP', 'AT_WAREHOUSE']) }, order: { createdAt: 'ASC' }, take: 200 });
  }

  /** Truck lookup by plate for the destination "scan the plate"
   *  flow. Returns the active (LOADING / IN_TRANSIT) manifest. */
  async findActiveTruck(plate: string): Promise<MzigoTruckManifest | null> {
    const normalised = plate.toUpperCase().replace(/\s+/g, '');
    return this.trucks.findOne({
      where: [
        { truckPlate: normalised, status: 'LOADING' },
        { truckPlate: normalised, status: 'IN_TRANSIT' },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async listParcelsOnTruck(plate: string) {
    const normalised = plate.toUpperCase().replace(/\s+/g, '');
    return this.parcels.find({
      where: { truckPlate: normalised, status: In(['ON_TRUCK', 'IN_TRANSIT', 'DELIVERED_DEST']) },
      order: { onTruckAt: 'ASC' },
    });
  }

  private async nextWaybill(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidate = genWaybill();
      const exists = await this.parcels.findOne({ where: { waybill: candidate } });
      if (!exists) return candidate;
    }
    throw new Error('Could not generate a unique waybill — try again');
  }
}
