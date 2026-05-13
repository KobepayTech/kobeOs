import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('discount_rules')
export class DiscountRule extends OwnedEntity {
  @Column()
  name!: string;

  @Column()
  type!: 'Percentage' | 'Fixed' | 'BOGO';

  @Column({ type: 'float' })
  value!: number;

  @Column({ default: 'All' })
  productScope!: string;

  @Column({ default: 'All' })
  customerScope!: string;

  @Column({ type: 'timestamptz', nullable: true })
  startDate?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endDate?: Date | null;

  @Column({ default: 'Active' })
  status!: 'Active' | 'Scheduled' | 'Expired';
}

@Entity('coupons')
export class Coupon extends OwnedEntity {
  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  type!: 'Percentage' | 'Fixed';

  @Column({ type: 'float' })
  value!: number;

  @Column({ default: 0 })
  usageLimit!: number;

  @Column({ default: 0 })
  usageCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ default: true })
  active!: boolean;
}

@Entity('campaigns')
export class Campaign extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  description!: string;

  @Column({ type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'timestamptz' })
  endDate!: Date;

  @Column({ default: 'Scheduled' })
  status!: 'Scheduled' | 'Active' | 'Expired';

  @Column({ type: 'float', default: 0 })
  budget!: number;
}
