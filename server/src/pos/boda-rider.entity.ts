import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('erp_boda_riders')
@Index('UQ_erp_boda_shop_user', ['shopId', 'userId'], { unique: true })
@Index('IDX_erp_boda_shop_location', ['shopId', 'locationAt'])
export class BodaRider extends BaseEntity {
  @Column('uuid') shopId!: string;
  @Column('uuid') userId!: string;
  @Column() name!: string;
  @Column() phone!: string;
  @Column('double precision', { nullable: true }) latitude!: number | null;
  @Column('double precision', { nullable: true }) longitude!: number | null;
  @Column('timestamptz', { nullable: true }) locationAt!: Date | null;
}
