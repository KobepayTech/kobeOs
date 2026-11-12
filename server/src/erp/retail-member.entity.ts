import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export const RETAIL_ROLES = ['manager', 'staff'] as const;
export type RetailRole = typeof RETAIL_ROLES[number];

@Entity('retail_shop_members')
@Index('UQ_retail_shop_member', ['shopId', 'userId'], { unique: true })
@Index('IDX_retail_shop_member_user', ['userId'])
export class RetailMember extends BaseEntity {
  @Column('uuid') shopId!: string;
  @Column('uuid') userId!: string;
  @Column({ type: 'varchar' }) role!: RetailRole;
}
