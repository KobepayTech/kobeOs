import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CargoLane } from './cargo.entity';

/**
 * Customer-facing booking pricing — used by the mobile cargo screen
 * to show "TZS X.XX, next dispatch Tuesday 24 Jun" before the
 * customer pays a deposit.
 *
 * Pricing model: lane.pricePerKg × weight, with a chargeable-weight
 * floor of 1 kg (so a 0.4 kg phone case still costs at least the
 * minimum). Volumetric weight (L×W×H/6000) is included so bulky-but-
 * light items don't undercharge — chargeable = max(actual, volumetric).
 */
export interface QuoteInput {
  laneId: string;
  weightKg: number;
  dimsCm?: { length: number; width: number; height: number };
}

export interface Quote {
  laneId: string;
  laneCode: string;
  laneName: string;
  currency: string;
  pricePerKg: number;
  actualWeight: number;
  volumetricWeight: number;
  chargeableWeight: number;
  total: number;
  origin: string;
  destination: string;
  defaultCarrier?: string | null;
  nextDispatchAt?: string | null;
}

const MIN_CHARGEABLE_KG = 1;
const VOLUMETRIC_DIVISOR = 6000;          // industry standard for air freight (cm³ / 6000)

@Injectable()
export class CargoBookingService {
  constructor(
    @InjectRepository(CargoLane) private readonly lanes: Repository<CargoLane>,
  ) {}

  async quote(uid: string, dto: QuoteInput): Promise<Quote> {
    if (!dto.weightKg || dto.weightKg <= 0) {
      throw new BadRequestException('weightKg must be > 0');
    }
    const lane = await this.lanes.findOne({ where: { id: dto.laneId, ownerId: uid, active: true } });
    if (!lane) throw new NotFoundException('Lane not found or inactive');

    const volumetric = dto.dimsCm
      ? (dto.dimsCm.length * dto.dimsCm.width * dto.dimsCm.height) / VOLUMETRIC_DIVISOR
      : 0;
    const chargeable = Math.max(MIN_CHARGEABLE_KG, dto.weightKg, volumetric);
    const total = parseFloat((Number(lane.pricePerKg) * chargeable).toFixed(2));

    return {
      laneId: lane.id,
      laneCode: lane.code,
      laneName: lane.name,
      currency: lane.currency,
      pricePerKg: Number(lane.pricePerKg),
      actualWeight: Number(dto.weightKg.toFixed(2)),
      volumetricWeight: parseFloat(volumetric.toFixed(2)),
      chargeableWeight: parseFloat(chargeable.toFixed(2)),
      total,
      origin: lane.origin,
      destination: lane.destination,
      defaultCarrier: lane.defaultCarrier ?? null,
      nextDispatchAt: nextDispatch(lane.dispatchDays)?.toISOString() ?? null,
    };
  }
}

/** Find the next ISO weekday in `days` (e.g. ["TUE","FRI"]) on or
 *  after today. Returns null when the lane has no schedule (on demand). */
function nextDispatch(days: string[]): Date | null {
  if (!days?.length) return null;
  const today = new Date();
  const wd = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  for (let offset = 0; offset < 14; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    if (days.includes(wd[d.getDay()])) {
      d.setHours(9, 0, 0, 0);
      return d;
    }
  }
  return null;
}
