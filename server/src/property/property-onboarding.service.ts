import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { Property, PropertyUnit } from './property.entity';
import { PropertyUnitLayout } from './property-layout.entity';
import {
  LayoutProposalDto,
  OnboardPropertyDto,
  PropertyLayoutUnitDto,
} from './dto/property.dto';

export interface LayoutProposal {
  summary: string;
  source: 'ai' | 'planner';
  floors: Array<{
    name: string;
    corridors: Array<{
      name: string;
      units: PropertyLayoutUnitDto[];
    }>;
  }>;
  units: PropertyLayoutUnitDto[];
  warnings: string[];
}

const MAX_UNITS = 500;

function textNumber(prompt: string, pattern: RegExp, fallback: number): number {
  const match = prompt.match(pattern);
  const value = match ? Number(match[1]) : fallback;
  return Number.isFinite(value) ? value : fallback;
}

function normaliseSide(value: unknown, index: number): PropertyLayoutUnitDto['corridorSide'] {
  if (value === 'left' || value === 'right' || value === 'end' || value === 'single') return value;
  return index % 2 === 0 ? 'left' : 'right';
}

@Injectable()
export class PropertyOnboardingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ai: AiService,
  ) {}

  private validateUnits(units: PropertyLayoutUnitDto[]) {
    if (!units.length) throw new BadRequestException('Add at least one room or unit');
    if (units.length > MAX_UNITS) throw new BadRequestException(`A property can be onboarded with at most ${MAX_UNITS} units at once`);

    const seen = new Set<string>();
    for (const unit of units) {
      const number = unit.unitNumber.trim();
      if (!number) throw new BadRequestException('Every room requires a number or name');
      const key = number.toLowerCase();
      if (seen.has(key)) throw new BadRequestException(`Duplicate room/unit number: ${number}`);
      seen.add(key);
      if ((unit.rentAmount ?? 0) < 0) throw new BadRequestException(`Room ${number} has an invalid rent amount`);
    }
  }

  async onboard(ownerId: string, dto: OnboardPropertyDto) {
    const units = dto.units.map((unit, index) => ({
      ...unit,
      unitNumber: unit.unitNumber.trim(),
      floor: unit.floor?.trim() || 'Ground',
      corridor: unit.corridor?.trim() || 'Main corridor',
      corridorSide: normaliseSide(unit.corridorSide, index),
      layoutPosition: unit.layoutPosition ?? index,
    }));
    this.validateUnits(units);

    return this.dataSource.transaction(async (manager) => {
      const propertyRepo = manager.getRepository(Property);
      const unitRepo = manager.getRepository(PropertyUnit);
      const layoutRepo = manager.getRepository(PropertyUnitLayout);

      const property = await propertyRepo.save(propertyRepo.create({
        ownerId,
        ...dto.property,
        name: dto.property.name.trim(),
        totalUnits: units.length,
        notes: dto.layoutPrompt
          ? [dto.property.notes, `Layout prompt: ${dto.layoutPrompt}`].filter(Boolean).join('\n')
          : (dto.property.notes ?? ''),
      }));

      const savedUnits: PropertyUnit[] = [];
      for (const input of units) {
        const saved = await unitRepo.save(unitRepo.create({
          ownerId,
          propertyId: property.id,
          unitNumber: input.unitNumber,
          type: input.type || 'room',
          bedrooms: input.bedrooms ?? 0,
          bathrooms: input.bathrooms ?? 0,
          sqft: input.sqft ?? 0,
          floor: input.floor,
          rentAmount: input.rentAmount ?? 0,
          currency: input.currency || 'TZS',
          status: input.status || 'vacant',
          notes: input.notes || '',
        }));
        await layoutRepo.save(layoutRepo.create({
          ownerId,
          propertyId: property.id,
          unitId: saved.id,
          floor: input.floor,
          corridor: input.corridor || 'Main corridor',
          corridorSide: input.corridorSide || 'single',
          position: input.layoutPosition ?? savedUnits.length,
        }));
        savedUnits.push(saved);
      }

      return {
        property,
        units: savedUnits,
        layout: units.map((unit, index) => ({
          unitId: savedUnits[index].id,
          unitNumber: unit.unitNumber,
          floor: unit.floor,
          corridor: unit.corridor,
          corridorSide: unit.corridorSide,
          position: unit.layoutPosition,
        })),
      };
    });
  }

  async getLayout(ownerId: string, propertyId: string) {
    const property = await this.dataSource.getRepository(Property).findOne({
      where: { ownerId, id: propertyId },
    });
    if (!property) throw new BadRequestException('Property not found');

    const units = await this.dataSource.getRepository(PropertyUnit).find({
      where: { ownerId, propertyId },
      order: { floor: 'ASC', unitNumber: 'ASC' },
    });
    const layouts = await this.dataSource.getRepository(PropertyUnitLayout).find({
      where: { ownerId, propertyId },
      order: { floor: 'ASC', corridor: 'ASC', position: 'ASC' },
    });
    const byUnit = new Map(layouts.map((layout) => [layout.unitId, layout]));
    return {
      property,
      units: units.map((unit, index) => {
        const layout = byUnit.get(unit.id);
        return {
          ...unit,
          corridor: layout?.corridor || 'Main corridor',
          corridorSide: layout?.corridorSide || 'single',
          layoutPosition: layout?.position ?? index,
        };
      }),
    };
  }

  async propose(dto: LayoutProposalDto): Promise<LayoutProposal> {
    const fallback = this.plannerProposal(dto);
    try {
      const raw = await this.ai.complete(
        `Create a hotel/property room layout from this request:\n${dto.prompt}\n\nDefaults: starting room ${dto.startingRoom || '101'}, type ${dto.defaultType || 'Standard'}, rent ${dto.defaultRent || 0} TZS.\nReturn JSON only with: {"summary":"...","floors":[{"name":"Floor 1","corridors":[{"name":"Main corridor","units":[{"unitNumber":"101","type":"Standard","floor":"Floor 1","corridor":"Main corridor","corridorSide":"left","layoutPosition":0,"bedrooms":1,"bathrooms":1,"rentAmount":0,"currency":"TZS","status":"vacant"}]}]}],"warnings":[]}. Maximum 500 units. Do not add prose or markdown.`,
        'You convert building descriptions into conservative, valid JSON room layouts. Never invent more floors or rooms than requested. Alternate rooms left/right for a central corridor.',
      );
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleaned) as Partial<LayoutProposal>;
      const units = (parsed.floors ?? []).flatMap((floor) =>
        (floor.corridors ?? []).flatMap((corridor) =>
          (corridor.units ?? []).map((unit, index) => ({
            ...unit,
            floor: unit.floor || floor.name,
            corridor: unit.corridor || corridor.name,
            corridorSide: normaliseSide(unit.corridorSide, index),
            layoutPosition: unit.layoutPosition ?? index,
          })),
        ),
      );
      this.validateUnits(units);
      return {
        summary: parsed.summary || fallback.summary,
        source: 'ai',
        floors: parsed.floors as LayoutProposal['floors'],
        units,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 20) : [],
      };
    } catch {
      return fallback;
    }
  }

  private plannerProposal(dto: LayoutProposalDto): LayoutProposal {
    const prompt = dto.prompt.toLowerCase();
    const floors = Math.min(50, Math.max(1, textNumber(prompt, /(\d+)\s*(?:floors?|storeys?)/i, 1)));
    const perFloor = Math.min(100, Math.max(1, textNumber(prompt, /(\d+)\s*(?:rooms?|units?)\s*(?:each|per)\s*floor/i, textNumber(prompt, /(\d+)\s*(?:rooms?|units?)/i, 6))));
    if (floors * perFloor > MAX_UNITS) throw new BadRequestException(`The requested layout exceeds ${MAX_UNITS} units`);

    const starting = Number((dto.startingRoom || prompt.match(/(?:start(?:ing)?\s*(?:at|room)?\s*|rooms?\s*)(\d{2,4})/i)?.[1] || '101').replace(/\D/g, '')) || 101;
    const central = /central|middle|both sides|left.*right/i.test(prompt);
    const floorRows: LayoutProposal['floors'] = [];
    const allUnits: PropertyLayoutUnitDto[] = [];

    for (let floorIndex = 0; floorIndex < floors; floorIndex += 1) {
      const floorNumber = floorIndex + 1;
      const floorName = `Floor ${floorNumber}`;
      const corridorName = central ? 'Central corridor' : 'Main corridor';
      const floorHundreds = Math.floor(starting / 100) + floorIndex;
      const startSuffix = starting % 100;
      const units: PropertyLayoutUnitDto[] = [];
      for (let index = 0; index < perFloor; index += 1) {
        const unitNumber = String(floorHundreds * 100 + startSuffix + index);
        const unit: PropertyLayoutUnitDto = {
          unitNumber,
          type: dto.defaultType || 'Standard',
          floor: floorName,
          corridor: corridorName,
          corridorSide: central ? (index % 2 === 0 ? 'left' : 'right') : 'single',
          layoutPosition: index,
          bedrooms: 1,
          bathrooms: 1,
          rentAmount: dto.defaultRent || 0,
          currency: 'TZS',
          status: 'vacant',
        };
        units.push(unit);
        allUnits.push(unit);
      }
      floorRows.push({
        name: floorName,
        corridors: [{ name: corridorName, units }],
      });
    }

    return {
      summary: `${floors} floor${floors === 1 ? '' : 's'}, ${perFloor} room${perFloor === 1 ? '' : 's'} per floor, ${allUnits.length} total`,
      source: 'planner',
      floors: floorRows,
      units: allUnits,
      warnings: ['AI runtime was unavailable or returned invalid data; a deterministic layout proposal was generated instead.'],
    };
  }
}
