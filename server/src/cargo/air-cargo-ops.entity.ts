import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';
import type { CustomsStage, CustomsStatus, DeliveryStatus, RiskLevel, TrackingEventType } from './air-cargo.entity';

@Entity('cargo_customs_flows')
@Index(['ownerId', 'shipmentId', 'stage'], { unique: false })
export class CargoCustomsFlow extends OwnedEntity {
  @Column({ nullable: true, type: 'uuid' }) shipmentId?: string | null;
  @Column({ nullable: true, type: 'uuid' }) parcelId?: string | null;
  @Column({ default: 'EXPORT' }) stage!: CustomsStage;
  @Column({ default: 'PENDING' }) status!: CustomsStatus;
  @Column({ type: 'jsonb', default: [] }) documents!: string[];
  @Column({ type: 'float', default: 0 }) taxAmount!: number;
  @Column({ default: 'TZS' }) taxCurrency!: string;
  @Column({ type: 'float', default: 0 }) delayHours!: number;
  @Column({ default: '' }) officerName!: string;
  @Column({ type: 'text', default: '' }) holdReason!: string;
  @Column({ type: 'timestamptz', nullable: true }) clearedAt?: Date | null;
}

@Entity('cargo_tracking_events')
@Index(['ownerId', 'shipmentId', 'eventType'], { unique: false })
export class CargoTrackingEvent extends OwnedEntity {
  @Column({ nullable: true, type: 'uuid' }) shipmentId?: string | null;
  @Column({ nullable: true, type: 'uuid' }) parcelId?: string | null;
  @Column() eventType!: TrackingEventType;
  @Column({ default: '' }) location!: string;
  @Column({ default: '' }) flightNumber!: string;
  @Column({ type: 'timestamptz' }) eventAt!: Date;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
  @Column({ type: 'text', default: '' }) notes!: string;
}

@Entity('cargo_operational_assessments')
@Index(['ownerId', 'shipmentId'], { unique: false })
export class CargoOperationalAssessment extends OwnedEntity {
  @Column({ nullable: true, type: 'uuid' }) shipmentId?: string | null;
  @Column({ nullable: true, type: 'uuid' }) routePlanId?: string | null;
  @Column({ default: 'LOW' }) riskLevel!: RiskLevel;
  @Column({ type: 'float', default: 0 }) riskScore!: number;
  @Column({ type: 'jsonb', default: [] }) findings!: string[];
  @Column({ type: 'jsonb', default: [] }) recommendedActions!: string[];
  @Column({ default: false }) rerouteRecommended!: boolean;
  @Column({ type: 'text', default: '' }) notes!: string;
}

@Entity('cargo_last_mile_deliveries')
@Index(['ownerId', 'shipmentId'], { unique: false })
export class CargoLastMileDelivery extends OwnedEntity {
  @Column({ nullable: true, type: 'uuid' }) shipmentId?: string | null;
  @Column({ nullable: true, type: 'uuid' }) parcelId?: string | null;
  @Column({ nullable: true, type: 'uuid' }) driverId?: string | null;
  @Column({ default: '' }) regionalHub!: string;
  @Column({ default: '' }) deliveryAddress!: string;
  @Column({ default: '' }) customerPhone!: string;
  @Column({ default: '' }) otpCode!: string;
  @Column({ default: false }) otpVerified!: boolean;
  @Column({ default: '' }) proofPhotoUrl!: string;
  @Column({ default: '' }) signatureUrl!: string;
  @Column({ default: 'PENDING' }) status!: DeliveryStatus;
  @Column({ type: 'timestamptz', nullable: true }) deliveredAt?: Date | null;
  @Column({ type: 'text', default: '' }) failureReason!: string;
  @Column({ type: 'text', default: '' }) notes!: string;
}

@Entity('cargo_analytics_snapshots')
@Index(['ownerId', 'period'], { unique: false })
export class CargoAnalyticsSnapshot extends OwnedEntity {
  @Column() period!: string;
  @Column({ type: 'float', default: 0 }) flightUtilization!: number;
  @Column({ type: 'float', default: 0 }) cargoVolumeKg!: number;
  @Column({ type: 'float', default: 0 }) averageTransitHours!: number;
  @Column({ type: 'float', default: 0 }) customsDelayHours!: number;
  @Column({ type: 'float', default: 0 }) routeProfitability!: number;
  @Column({ type: 'jsonb', default: {} }) airlinePerformance!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) delayHeatmap!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) airportEfficiency!: Record<string, unknown>;
}
