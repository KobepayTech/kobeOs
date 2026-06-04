import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type RoutePriority = 'STANDARD' | 'EXPRESS' | 'SMART_MULTI_HUB';
export type RouteStatus = 'DRAFT' | 'PLANNED' | 'ACTIVE' | 'REROUTED' | 'COMPLETED' | 'CANCELLED';
export type HubType = 'PRIMARY' | 'EMERGENCY' | 'CUSTOMS' | 'EXPRESS' | 'REGIONAL_REDISTRIBUTION';
export type CustomsStage = 'EXPORT' | 'IMPORT';
export type CustomsStatus = 'PENDING' | 'DOCUMENTS_CHECKED' | 'CLEARED' | 'HELD' | 'TAX_REQUIRED' | 'REJECTED';
export type TrackingEventType = 'SHIPMENT_CREATED' | 'CARGO_CONSOLIDATED' | 'FLIGHT_ASSIGNED' | 'EXPORT_CUSTOMS_CLEARED' | 'CARGO_LOADED' | 'FLIGHT_DEPARTED' | 'ARRIVED_TRANSIT_HUB' | 'CUSTOMS_CLEARED' | 'WAREHOUSE_SORTED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REROUTED' | 'OPERATIONS_ALERT';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';

@Entity('cargo_air_hubs')
@Index(['ownerId', 'code'], { unique: true })
export class CargoAirHub extends OwnedEntity {
  @Column() code!: string;
  @Column() name!: string;
  @Column() country!: string;
  @Column({ default: '' }) city!: string;
  @Column({ default: 'PRIMARY' }) type!: HubType;
  @Column({ type: 'float', default: 0 }) delayHours!: number;
  @Column({ type: 'float', default: 100 }) reliabilityScore!: number;
  @Column({ default: true }) active!: boolean;
  @Column({ type: 'text', default: '' }) notes!: string;
}

@Entity('cargo_airlines')
@Index(['ownerId', 'code'], { unique: true })
export class CargoAirline extends OwnedEntity {
  @Column() code!: string;
  @Column() name!: string;
  @Column({ default: '' }) contractRef!: string;
  @Column({ type: 'float', default: 0 }) pricePerKg!: number;
  @Column({ default: 'USD' }) currency!: string;
  @Column({ type: 'float', default: 100 }) reliabilityScore!: number;
  @Column({ type: 'float', default: 0 }) averageDelayHours!: number;
  @Column({ type: 'float', default: 0 }) cargoCapacityKg!: number;
  @Column({ default: true }) active!: boolean;
  @Column({ type: 'text', default: '' }) notes!: string;
}

@Entity('cargo_air_route_plans')
@Index(['ownerId', 'routeCode'], { unique: true })
export class CargoAirRoutePlan extends OwnedEntity {
  @Column() routeCode!: string;
  @Index() @Column({ nullable: true, type: 'uuid' }) shipmentId?: string | null;
  @Column({ default: 'STANDARD' }) priority!: RoutePriority;
  @Column() origin!: string;
  @Column() destination!: string;
  @Column({ default: '' }) cargoType!: string;
  @Column({ type: 'float', default: 0 }) weightKg!: number;
  @Column({ type: 'jsonb', default: [] }) hubs!: string[];
  @Column({ type: 'jsonb', default: [] }) routeSteps!: string[];
  @Column({ default: '' }) selectedAirline!: string;
  @Column({ default: '' }) selectedFlightNumber!: string;
  @Column({ type: 'float', default: 0 }) estimatedFlightHours!: number;
  @Column({ type: 'float', default: 0 }) customsDelayHours!: number;
  @Column({ type: 'float', default: 0 }) transitDelayHours!: number;
  @Column({ type: 'float', default: 0 }) deliveryHours!: number;
  @Column({ type: 'float', default: 0 }) etaHours!: number;
  @Column({ type: 'timestamptz', nullable: true }) estimatedArrivalAt?: Date | null;
  @Column({ default: 'LOW' }) riskLevel!: RiskLevel;
  @Column({ type: 'jsonb', default: [] }) riskReasons!: string[];
  @Column({ default: 'PLANNED' }) status!: RouteStatus;
  @Column({ type: 'text', default: '' }) decisionReason!: string;
  @Column({ type: 'text', default: '' }) notes!: string;
}
