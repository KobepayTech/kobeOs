import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OwnedEntity } from '../common/owned.entity';

export type BusinessTier = 'LITE' | 'FULL';

@Entity('commerce_businesses')
export class CommerceBusiness extends BaseEntity {
  @Index({ unique: true }) @Column() businessId!: string;
  @Index({ unique: true }) @Column() publicSlug!: string;
  @Index() @Column({ type: 'uuid', nullable: true }) ownerUserId?: string | null;
  @Column('uuid') catalogOwnerId!: string;
  @Column() name!: string;
  @Column({ default: '' }) merchantName!: string;
  @Column({ default: '' }) phone!: string;
  @Column({ default: '' }) email!: string;
  @Column({ default: 'LITE' }) tier!: BusinessTier;
  @Column({ default: 'ACTIVE' }) status!: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  @Column({ default: false }) websiteEnabled!: boolean;
  @Column({ default: '' }) managementTokenHash!: string;
  @Column({ type: 'jsonb', default: {} }) profile!: Record<string, unknown>;
}

@Entity('commerce_business_locations')
@Index(['businessId', 'shopUnitId'], { unique: true })
export class BusinessLocation extends BaseEntity {
  @Column('uuid') businessId!: string;
  @Column({ type: 'uuid', nullable: true }) propertyId?: string | null;
  @Column({ type: 'uuid', nullable: true }) shopUnitId?: string | null;
  @Column() name!: string;
  @Column({ default: '' }) address!: string;
  @Column({ default: '' }) latitude!: string;
  @Column({ default: '' }) longitude!: string;
  @Column({ default: true }) active!: boolean;
}

@Entity('commerce_property_floors')
@Index(['ownerId', 'propertyId', 'code'], { unique: true })
export class PropertyFloor extends OwnedEntity {
  @Column('uuid') propertyId!: string;
  @Column() name!: string;
  @Column() code!: string;
  @Column({ type: 'int', default: 0 }) level!: number;
  @Column({ type: 'int', default: 0 }) shopCount!: number;
}

@Entity('commerce_shop_units')
@Index(['publicCode'], { unique: true })
@Index(['ownerId', 'propertyId', 'floorId', 'unitNumber'], { unique: true })
export class CommerceShopUnit extends OwnedEntity {
  @Column('uuid') propertyId!: string;
  @Column('uuid') floorId!: string;
  @Column() unitNumber!: string;
  @Column() publicCode!: string;
  @Column({ default: '' }) categoryId!: string;
  @Column({ default: 'AVAILABLE' }) status!: 'AVAILABLE' | 'CLAIMED' | 'INACTIVE';
  @Column({ type: 'uuid', nullable: true }) businessId?: string | null;
}

@Entity('commerce_merchant_claims')
@Index(['shopUnitId', 'status'])
export class MerchantClaim extends BaseEntity {
  @Column('uuid') propertyId!: string;
  @Column('uuid') shopUnitId!: string;
  @Column('uuid') businessId!: string;
  @Column() claimantName!: string;
  @Column() claimantPhone!: string;
  @Column({ default: '' }) categoryId!: string;
  @Column({ default: 'APPROVED' }) status!: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';
  @Column({ type: 'timestamptz', nullable: true }) decidedAt?: Date | null;
}

@Entity('commerce_categories')
@Index(['slug'], { unique: true })
export class CommerceCategory extends BaseEntity {
  @Column() name!: string;
  @Column() slug!: string;
  @Column({ type: 'uuid', nullable: true }) parentId?: string | null;
  @Column({ default: '' }) icon!: string;
  @Column({ default: true }) active!: boolean;
  @Column({ type: 'int', default: 0 }) sortOrder!: number;
}

@Entity('commerce_product_media')
@Index(['productId', 'sortOrder'])
export class CommerceProductMedia extends BaseEntity {
  @Column('uuid') productId!: string;
  @Column() url!: string;
  @Column({ default: 'IMAGE' }) kind!: 'IMAGE' | 'VIDEO';
  @Column({ type: 'int', default: 0 }) sortOrder!: number;
  @Column({ type: 'jsonb', default: {} }) crop!: Record<string, number>;
  @Index({ unique: true }) @Column({ nullable: true, type: 'varchar' }) publicToken?: string | null;
  @Column({ nullable: true, type: 'varchar' }) mimeType?: string | null;
  @Column({ type: 'bytea', nullable: true }) contentBinary?: Buffer | null;
}

@Entity('commerce_nodes')
@Index(['businessId'], { unique: true })
export class KobeNode extends BaseEntity {
  @Column('uuid') businessId!: string;
  @Column() nodeName!: string;
  @Column() nodeKeyHash!: string;
  @Column({ default: 'OFFLINE' }) status!: 'ONLINE' | 'OFFLINE';
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt?: Date | null;
  @Column({ default: '' }) version!: string;
  @Column({ default: '' }) endpoint!: string;
  @Column({ default: '' }) catalogueVersion!: string;
}

@Entity('commerce_node_heartbeats')
@Index(['nodeId', 'receivedAt'])
export class NodeHeartbeat extends BaseEntity {
  @Column('uuid') nodeId!: string;
  @Column('uuid') businessId!: string;
  @Column({ type: 'timestamptz' }) receivedAt!: Date;
  @Column({ default: 'ONLINE' }) state!: 'ONLINE' | 'OFFLINE';
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
}

@Entity('commerce_product_snippets')
@Index(['businessId', 'productId'], { unique: true })
@Index(['active', 'category'])
export class ProductSnippet extends BaseEntity {
  @Column('uuid') businessId!: string;
  @Column('uuid') productId!: string;
  @Column('uuid') catalogOwnerId!: string;
  @Column({ type: 'uuid', nullable: true }) nodeId?: string | null;
  @Column() name!: string;
  @Column({ default: '' }) description!: string;
  @Column({ default: '' }) category!: string;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) price!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: '' }) imageUrl!: string;
  @Column({ type: 'int', default: 0 }) stock!: number;
  @Column({ default: true }) active!: boolean;
  @Column({ type: 'timestamptz' }) indexedAt!: Date;
  @Column({ default: '' }) merchantWebsite!: string;
  @Column({ default: '' }) locationLabel!: string;
  @Column({ type: 'timestamptz', nullable: true }) lastOnlineAt?: Date | null;
  @Column({ default: '' }) availabilityHint!: string;
}

@Entity('commerce_customers')
@Index(['phone'], { unique: true })
export class CommerceCustomer extends BaseEntity {
  @Column() phone!: string;
  @Column({ default: '' }) name!: string;
  @Column({ default: '' }) email!: string;
  @Column({ default: '' }) defaultAddress!: string;
  @Column({ type: 'jsonb', default: {} }) preferences!: Record<string, unknown>;
}

@Entity('commerce_carts')
@Index(['customerId', 'status'])
export class CommerceCart extends BaseEntity {
  @Column('uuid') customerId!: string;
  @Column({ default: 'OPEN' }) status!: 'OPEN' | 'SUBMITTED' | 'ABANDONED';
  @Column({ default: 'TZS' }) currency!: string;
}

@Entity('commerce_cart_lines')
@Index(['cartId', 'productId'])
export class CommerceCartLine extends BaseEntity {
  @Column('uuid') cartId!: string;
  @Column('uuid') businessId!: string;
  @Column('uuid') productId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) quantity!: number;
  @Column({ type: 'jsonb', default: {} }) selectedOptions!: Record<string, string>;
}

@Entity('commerce_merchant_orders')
@Index(['businessId', 'createdAt'])
@Index(['orderNumber'], { unique: true })
export class MerchantOrder extends BaseEntity {
  @Column() orderNumber!: string;
  @Column('uuid') businessId!: string;
  @Column('uuid') customerId!: string;
  @Column('uuid') cartId!: string;
  @Column({ default: 'SUBMITTED' }) status!: 'DRAFT' | 'SUBMITTED' | 'VIEWED' | 'ACCEPTED' | 'RESERVED' | 'PAYMENT_PENDING' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'UNAVAILABLE' | 'WAITING_ACTIVATION';
  @Column({ default: 'PICKUP' }) fulfillment!: 'PICKUP' | 'DELIVERY';
  @Column({ default: '' }) deliveryAddress!: string;
  @Column({ default: '' }) customerNote!: string;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) total!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: false }) merchantLocked!: boolean;
  @Column({ default: 'jumla' }) channel!: string;
}

@Entity('commerce_order_lines')
@Index(['merchantOrderId'])
export class CommerceOrderLine extends BaseEntity {
  @Column('uuid') merchantOrderId!: string;
  @Column('uuid') productId!: string;
  @Column() productName!: string;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) unitPrice!: number;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) quantity!: number;
  @Column({ type: 'decimal', precision: 18, scale: 4 }) lineTotal!: number;
  @Column({ type: 'jsonb', default: {} }) selectedOptions!: Record<string, string>;
}

@Entity('commerce_merchant_quotas')
@Index(['businessId'], { unique: true })
export class MerchantQuota extends BaseEntity {
  @Column('uuid') businessId!: string;
  @Column({ type: 'int', default: 50 }) freeOrderLimit!: number;
  @Column({ type: 'int', default: 0 }) submittedOrders!: number;
  @Column({ type: 'int', default: 0 }) lockedOrders!: number;
  @Column({ type: 'timestamptz', nullable: true }) activatedAt?: Date | null;
}

@Entity('commerce_interest_events')
@Index(['productId', 'createdAt'])
export class InterestEvent extends BaseEntity {
  @Column('uuid') productId!: string;
  @Column('uuid') businessId!: string;
  @Column({ type: 'uuid', nullable: true }) customerId?: string | null;
  @Column() eventType!: 'VIEW' | 'SWIPE_LEFT' | 'SWIPE_RIGHT' | 'CART' | 'BUY';
  @Column({ default: '' }) sessionId!: string;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
}

export const COMMERCE_ENTITIES = [
  CommerceBusiness, BusinessLocation, PropertyFloor, CommerceShopUnit, MerchantClaim,
  CommerceCategory, CommerceProductMedia, KobeNode, NodeHeartbeat, ProductSnippet,
  CommerceCustomer, CommerceCart, CommerceCartLine, MerchantOrder, CommerceOrderLine,
  MerchantQuota, InterestEvent,
] as const;
