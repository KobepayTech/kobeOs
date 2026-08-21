import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';
import type { TransitComplianceState } from './transit.rules';

export type TransitRegistrationStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';
export type TransitTripStatus = 'SCHEDULED' | 'BOARDING' | 'DEPARTED' | 'IN_TRANSIT' | 'ARRIVED' | 'CANCELLED';

@Entity('transit_operators')
@Index(['ownerId', 'name'], { unique: true })
export class TransitOperator extends OwnedEntity {
  @Column() name!: string;
  @Column({ default: '' }) registrationNumber!: string;
  @Column({ default: '' }) phone!: string;
  @Column({ default: '' }) email!: string;
  @Column({ default: '' }) region!: string;
  @Column({ default: 'ACTIVE' }) status!: TransitRegistrationStatus;
}

@Entity('transit_routes')
@Index(['ownerId', 'code'], { unique: true })
export class TransitRoute extends OwnedEntity {
  @Column() code!: string;
  @Column() name!: string;
  @Column() origin!: string;
  @Column() destination!: string;
  @Column({ default: '' }) region!: string;
  @Column({ type: 'int', default: 0 }) typicalMinutes!: number;
  @Column({ default: true }) active!: boolean;
}

@Entity('transit_checkpoints')
@Index(['ownerId', 'routeId', 'sequence'])
export class TransitCheckpoint extends OwnedEntity {
  @Column({ type: 'uuid', nullable: true }) routeId?: string | null;
  @Column() name!: string;
  @Column({ default: '' }) region!: string;
  @Column({ default: '' }) latitude!: string;
  @Column({ default: '' }) longitude!: string;
  @Column({ type: 'int', default: 0 }) sequence!: number;
  @Column({ type: 'int', default: 0 }) minutesToDestination!: number;
  @Column({ default: true }) active!: boolean;
}

@Entity('transit_cameras')
@Index(['ownerId', 'code'], { unique: true })
export class TransitCamera extends OwnedEntity {
  @Column() code!: string;
  @Column() name!: string;
  @Column({ type: 'uuid', nullable: true }) checkpointId?: string | null;
  @Column({ default: '' }) location!: string;
  @Column({ default: 'BOTH' }) direction!: 'ENTRY' | 'EXIT' | 'BOTH';
  @Column({ type: 'float', default: 0.85 }) confidenceThreshold!: number;
  @Column({ default: true }) active!: boolean;
  @Column({ default: '' }) apiKeyHash!: string;
  @Column({ type: 'timestamptz', nullable: true }) lastHeartbeatAt?: Date | null;
}

@Entity('transit_buses')
@Index(['ownerId', 'operatorId'])
export class TransitBus extends OwnedEntity {
  @Column('uuid') operatorId!: string;
  @Index({ unique: true }) @Column() vehicleIdentity!: string;
  @Column() name!: string;
  @Column({ default: '' }) defaultOrigin!: string;
  @Column({ default: '' }) defaultDestination!: string;
  @Column({ type: 'uuid', nullable: true }) routeId?: string | null;
  @Column({ default: '' }) conductorName!: string;
  @Column({ default: '' }) conductorPhone!: string;
  @Column({ type: 'int', default: 0 }) capacity!: number;
  @Column({ default: 'ACTIVE' }) registrationStatus!: TransitRegistrationStatus;
  @Column({ default: 'DUE_SOON' }) complianceStatus!: TransitComplianceState;
  @Column({ type: 'timestamptz', nullable: true }) paidThrough?: Date | null;
  @Column({ type: 'uuid', nullable: true }) currentPlateId?: string | null;
  @Column({ default: '' }) currentLocation!: string;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt?: Date | null;
  @Column({ default: false }) suspended!: boolean;
}

@Entity('transit_plates')
@Index(['ownerId', 'normalizedPlate'], { unique: true })
@Index(['ownerId', 'busId', 'active'])
export class TransitPlate extends OwnedEntity {
  @Column('uuid') busId!: string;
  @Column() plateNumber!: string;
  @Column() normalizedPlate!: string;
  @Column({ default: true }) active!: boolean;
  @Column({ type: 'timestamptz' }) effectiveFrom!: Date;
  @Column({ type: 'timestamptz', nullable: true }) effectiveTo?: Date | null;
  @Column({ type: 'uuid', nullable: true }) replacedPlateId?: string | null;
}

@Entity('transit_bus_operator_history')
@Index(['ownerId', 'busId', 'effectiveFrom'])
export class TransitBusOperatorHistory extends OwnedEntity {
  @Column('uuid') busId!: string;
  @Column('uuid') operatorId!: string;
  @Column({ type: 'timestamptz' }) effectiveFrom!: Date;
  @Column({ type: 'timestamptz', nullable: true }) effectiveTo?: Date | null;
  @Column({ default: '' }) reason!: string;
  @Column({ default: '' }) changedBy!: string;
}

@Entity('transit_trips')
@Index(['ownerId', 'tripCode'], { unique: true })
@Index(['ownerId', 'busId', 'status'])
export class TransitTrip extends OwnedEntity {
  @Column('uuid') busId!: string;
  @Column({ type: 'uuid', nullable: true }) routeId?: string | null;
  @Column() tripCode!: string;
  @Column() origin!: string;
  @Column() destination!: string;
  @Column({ type: 'timestamptz' }) scheduledDeparture!: Date;
  @Column({ type: 'timestamptz', nullable: true }) actualDeparture?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) scheduledArrival?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) eta?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) actualArrival?: Date | null;
  @Column({ default: 'SCHEDULED' }) status!: TransitTripStatus;
  @Column({ default: '' }) gate!: string;
  @Column({ default: '' }) currentCheckpoint!: string;
  @Column({ type: 'int', default: 0 }) delayMinutes!: number;
}

@Entity('transit_trip_location_events')
@Index(['ownerId', 'tripId', 'occurredAt'])
export class TransitTripLocationEvent extends OwnedEntity {
  @Column('uuid') tripId!: string;
  @Column('uuid') busId!: string;
  @Column({ type: 'uuid', nullable: true }) checkpointId?: string | null;
  @Column({ default: '' }) locationName!: string;
  @Column({ default: '' }) latitude!: string;
  @Column({ default: '' }) longitude!: string;
  @Column({ default: 'CAMERA' }) source!: 'CAMERA' | 'GPS' | 'MANUAL';
  @Column({ default: '' }) sourceEventId!: string;
  @Column({ type: 'timestamptz' }) occurredAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) eta?: Date | null;
}

@Entity('transit_trip_followers')
@Index(['ownerId', 'tripId', 'phone'], { unique: true })
export class TransitTripFollower extends OwnedEntity {
  @Column('uuid') tripId!: string;
  @Column() phone!: string;
  @Column({ default: '' }) name!: string;
  @Column({ type: 'uuid', nullable: true }) pickupCheckpointId?: string | null;
  @Column({ type: 'int', default: 30 }) notifyBeforeMinutes!: number;
  @Column({ type: 'jsonb', default: ['SMS', 'PUSH'] }) channels!: string[];
  @Column({ default: true }) active!: boolean;
}

@Entity('transit_arrival_alerts')
@Index(['ownerId', 'followerId', 'eventKey'], { unique: true })
export class TransitArrivalAlert extends OwnedEntity {
  @Column('uuid') tripId!: string;
  @Column('uuid') followerId!: string;
  @Column() eventKey!: string;
  @Column() kind!: 'DEPARTED' | 'CHECKPOINT' | 'PICKUP_ETA' | 'ARRIVED';
  @Column({ type: 'text' }) message!: string;
  @Column({ default: 'PENDING' }) status!: 'PENDING' | 'SENT' | 'FAILED';
  @Column({ type: 'timestamptz', nullable: true }) sentAt?: Date | null;
}

@Entity('transit_tickets')
@Index(['ownerId', 'ticketNumber'], { unique: true })
@Index(['ownerId', 'tripId', 'seatNumber'], { unique: true })
export class TransitTicket extends OwnedEntity {
  @Column('uuid') tripId!: string;
  @Column() ticketNumber!: string;
  @Column() passengerName!: string;
  @Column() passengerPhone!: string;
  @Column() seatNumber!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) fare!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: 'RESERVED' }) status!: 'RESERVED' | 'PAID' | 'BOARDED' | 'CANCELLED';
  @Column({ default: '' }) paymentReference!: string;
}

@Entity('transit_passenger_manifests')
@Index(['ownerId', 'ticketId'], { unique: true })
export class TransitPassengerManifest extends OwnedEntity {
  @Column('uuid') tripId!: string;
  @Column('uuid') ticketId!: string;
  @Column() passengerName!: string;
  @Column() passengerPhone!: string;
  @Column() seatNumber!: string;
  @Column({ default: false }) boarded!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) boardedAt?: Date | null;
}

@Entity('transit_vehicle_checkpoint_events')
@Index(['ownerId', 'vehicleId', 'occurredAt'])
export class TransitVehicleCheckpointEvent extends OwnedEntity {
  @Column() vehicleType!: 'BUS' | 'TRUCK' | 'CARGO' | 'DELIVERY' | 'FLEET';
  @Column() vehicleId!: string;
  @Column({ type: 'uuid', nullable: true }) checkpointId?: string | null;
  @Column({ default: '' }) locationName!: string;
  @Column({ default: 'CAMERA' }) source!: 'CAMERA' | 'GPS' | 'MANUAL';
  @Column({ type: 'timestamptz' }) occurredAt!: Date;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
}

@Entity('transit_authority_grants')
@Index(['ownerId', 'authorityUserId', 'role'], { unique: true })
export class TransitAuthorityGrant extends OwnedEntity {
  @Column('uuid') authorityUserId!: string;
  @Column() role!: 'government_viewer' | 'settlement_officer' | 'compliance_officer' | 'traffic_enforcement';
  @Column({ type: 'jsonb', default: {} }) scope!: Record<string, unknown>;
  @Column({ default: true }) active!: boolean;
  @Column({ default: '' }) grantedBy!: string;
}

@Entity('transit_plate_detections')
@Index(['ownerId', 'normalizedPlate', 'detectedAt'])
export class TransitPlateDetection extends OwnedEntity {
  @Column() observedPlate!: string;
  @Column() normalizedPlate!: string;
  @Column('uuid') cameraId!: string;
  @Column({ type: 'uuid', nullable: true }) checkpointId?: string | null;
  @Column({ type: 'uuid', nullable: true }) busId?: string | null;
  @Column({ type: 'uuid', nullable: true }) tripId?: string | null;
  @Column({ type: 'float' }) confidence!: number;
  @Column({ default: '' }) direction!: string;
  @Column({ default: '' }) imageUrl!: string;
  @Column({ type: 'timestamptz' }) detectedAt!: Date;
  @Column({ default: 'AUTOMATIC' }) reviewStatus!: 'AUTOMATIC' | 'MANUAL_REVIEW' | 'CONFIRMED' | 'REJECTED';
  @Column({ default: '' }) complianceStatus!: TransitComplianceState | '';
}

@Entity('transit_fee_policies')
@Index(['ownerId', 'active'])
export class TransitFeePolicy extends OwnedEntity {
  @Column({ type: 'decimal', precision: 18, scale: 2 }) feeAmount!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'int', default: 7 }) periodDays!: number;
  @Column({ type: 'timestamptz' }) effectiveAt!: Date;
  @Column({ type: 'int', default: 2 }) graceDays!: number;
  @Column({ type: 'int', default: 2 }) dueSoonDays!: number;
  @Column({ type: 'decimal', precision: 7, scale: 4, default: 50 }) governmentPercent!: number;
  @Column({ type: 'decimal', precision: 7, scale: 4, default: 50 }) kobePercent!: number;
  @Column({ type: 'simple-json', default: '{}' }) enforcementRules!: Record<string, unknown>;
  @Column({ type: 'simple-json', default: '{}' }) exemptionRules!: Record<string, unknown>;
  @Column({ type: 'float', default: 0.85 }) automaticAnprThreshold!: number;
  @Column({ default: true }) active!: boolean;
}

@Entity('transit_fee_periods')
@Index(['ownerId', 'busId', 'periodStart'], { unique: true })
export class TransitFeePeriod extends OwnedEntity {
  @Column('uuid') busId!: string;
  @Column('uuid') plateId!: string;
  @Column('uuid') policyId!: string;
  @Column({ type: 'timestamptz' }) periodStart!: Date;
  @Column({ type: 'timestamptz' }) periodEnd!: Date;
  @Column({ type: 'timestamptz' }) dueAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) paidAt?: Date | null;
  @Column({ type: 'uuid', nullable: true }) paymentId?: string | null;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) amountDue!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) amountPaid!: number;
  @Column({ default: 'DUE_SOON' }) status!: TransitComplianceState;
}

@Entity('transit_fee_payments')
@Index(['ownerId', 'idempotencyKey'], { unique: true })
@Index(['ownerId', 'paymentReference'], { unique: true })
@Index(['ownerId', 'externalReference'], { unique: true })
export class TransitFeePayment extends OwnedEntity {
  @Column('uuid') operatorId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) amount!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column() method!: string;
  @Column() externalReference!: string;
  @Column() verificationReference!: string;
  @Column() paymentReference!: string;
  @Column() receiptNumber!: string;
  @Column() idempotencyKey!: string;
  @Column({ default: false }) verified!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt?: Date | null;
  @Column({ type: 'int', default: 1 }) busCount!: number;
  @Column({ default: 'VERIFIED' }) status!: 'VERIFIED' | 'REVERSED' | 'DISPUTED';
}

@Entity('transit_fee_allocations')
@Index(['ownerId', 'paymentId', 'busId'], { unique: true })
@Index(['ownerId', 'settlementStatus'])
export class TransitFeeAllocation extends OwnedEntity {
  @Column('uuid') paymentId!: string;
  @Column('uuid') feePeriodId!: string;
  @Column('uuid') busId!: string;
  @Column('uuid') plateId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) grossAmount!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) governmentAmount!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) kobeAmount!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) processingFee!: number;
  @Column({ default: 'ACCRUED' }) settlementStatus!: 'ACCRUED' | 'PENDING' | 'SETTLED' | 'RECONCILED' | 'DISPUTED';
  @Column({ type: 'uuid', nullable: true }) settlementId?: string | null;
}

@Entity('transit_unpaid_detections')
@Index(['ownerId', 'busId', 'status'])
export class TransitUnpaidDetection extends OwnedEntity {
  @Column('uuid') detectionId!: string;
  @Column('uuid') busId!: string;
  @Column('uuid') plateId!: string;
  @Column({ type: 'uuid', nullable: true }) policyId?: string | null;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) outstandingAmount!: number;
  @Column({ default: '' }) checkpointName!: string;
  @Column({ default: '' }) imageUrl!: string;
  @Column({ default: 'OPEN' }) status!: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt?: Date | null;
}

@Entity('transit_enforcement_alerts')
@Index(['ownerId', 'busId', 'status'])
export class TransitEnforcementAlert extends OwnedEntity {
  @Column('uuid') unpaidDetectionId!: string;
  @Column('uuid') detectionId!: string;
  @Column('uuid') busId!: string;
  @Column('uuid') plateId!: string;
  @Column({ default: 'TRAFFIC_GOVERNMENT_DASHBOARD' }) destination!: string;
  @Column({ type: 'text' }) message!: string;
  @Column({ default: 'OPEN' }) status!: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt?: Date | null;
  @Column({ default: '' }) resolutionNote!: string;
}

@Entity('transit_exemptions')
@Index(['ownerId', 'busId', 'status'])
export class TransitExemption extends OwnedEntity {
  @Column('uuid') busId!: string;
  @Column() exemptionType!: string;
  @Column() authority!: string;
  @Column({ type: 'text' }) reason!: string;
  @Column({ type: 'timestamptz' }) effectiveAt!: Date;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ default: '' }) supportingDocumentUrl!: string;
  @Column({ default: '' }) createdBy!: string;
  @Column({ default: '' }) approvedBy!: string;
  @Column({ default: 'PENDING' }) status!: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
}

@Entity('transit_off_road_periods')
@Index(['ownerId', 'busId', 'status'])
export class TransitOffRoadPeriod extends OwnedEntity {
  @Column('uuid') busId!: string;
  @Column({ type: 'text' }) reason!: string;
  @Column({ type: 'timestamptz' }) startsAt!: Date;
  @Column({ type: 'timestamptz' }) endsAt!: Date;
  @Column({ default: '' }) evidenceUrl!: string;
  @Column({ default: '' }) approvedBy!: string;
  @Column({ default: 'PENDING' }) status!: 'PENDING' | 'APPROVED' | 'REJECTED';
  @Column({ default: 'NORMAL' }) feeTreatment!: 'NORMAL' | 'EXEMPT';
}

@Entity('transit_payment_disputes')
@Index(['ownerId', 'busId', 'status'])
export class TransitPaymentDispute extends OwnedEntity {
  @Column('uuid') busId!: string;
  @Column({ default: '' }) transactionId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) amount!: number;
  @Column() paymentProvider!: string;
  @Column({ type: 'timestamptz' }) paymentDate!: Date;
  @Column({ default: '' }) receiptUrl!: string;
  @Column({ type: 'text' }) explanation!: string;
  @Column({ default: 'SUBMITTED' }) status!: 'SUBMITTED' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';
  @Column({ default: '' }) resolutionNote!: string;
}

@Entity('transit_government_settlements')
@Index(['ownerId', 'settlementReference'], { unique: true })
export class TransitGovernmentSettlement extends OwnedEntity {
  @Column() settlementReference!: string;
  @Column({ type: 'timestamptz' }) periodStart!: Date;
  @Column({ type: 'timestamptz' }) periodEnd!: Date;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) grossAmount!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) governmentAmount!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) kobeAmount!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) processingFees!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) settledAmount!: number;
  @Column({ default: 'ACCRUED' }) status!: 'ACCRUED' | 'PENDING' | 'SETTLED' | 'RECONCILED' | 'DISPUTED';
  @Column({ default: '' }) paymentReference!: string;
  @Column({ type: 'timestamptz', nullable: true }) settledAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) reconciledAt?: Date | null;
  @Column({ default: '' }) reconciliationNote!: string;
}

@Entity('transit_government_settlement_lines')
@Index(['ownerId', 'settlementId', 'allocationId'], { unique: true })
export class TransitGovernmentSettlementLine extends OwnedEntity {
  @Column('uuid') settlementId!: string;
  @Column('uuid') allocationId!: string;
  @Column('uuid') paymentId!: string;
  @Column('uuid') busId!: string;
  @Column('uuid') plateId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) governmentAmount!: number;
}

@Entity('transit_compliance_audits')
@Index(['ownerId', 'eventKey'], { unique: true })
@Index(['ownerId', 'busId', 'createdAt'])
export class TransitComplianceAudit extends OwnedEntity {
  @Column('uuid') busId!: string;
  @Column({ type: 'uuid', nullable: true }) plateId?: string | null;
  @Column() eventType!: string;
  @Column() eventKey!: string;
  @Column({ default: '' }) fromStatus!: string;
  @Column({ default: '' }) toStatus!: string;
  @Column({ type: 'text', default: '' }) message!: string;
  @Column({ type: 'simple-json', default: '{}' }) metadata!: Record<string, unknown>;
}

export const TRANSIT_ENTITIES = [
  TransitOperator, TransitRoute, TransitCheckpoint, TransitCamera, TransitBus,
  TransitPlate, TransitTrip, TransitPlateDetection, TransitFeePolicy,
  TransitFeePeriod, TransitFeePayment, TransitFeeAllocation,
  TransitUnpaidDetection, TransitEnforcementAlert, TransitExemption,
  TransitOffRoadPeriod, TransitPaymentDispute, TransitGovernmentSettlement,
  TransitGovernmentSettlementLine, TransitComplianceAudit,
  TransitTripLocationEvent, TransitTripFollower, TransitArrivalAlert, TransitTicket,
  TransitPassengerManifest, TransitVehicleCheckpointEvent, TransitAuthorityGrant,
  TransitBusOperatorHistory,
];
