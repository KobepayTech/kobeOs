import { Entity, Column, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('hotel_financials')
export class HotelFinancialRecord extends OwnedEntity {
  @Index()
  @Column('uuid')
  hotelId!: string;

  /** room_revenue, restaurant_revenue, service_revenue, staff_expense, maintenance_expense, supply_expense, other */
  @Column()
  category!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'date' })
  recordDate!: Date;

  @Column({ default: '' })
  description!: string;

  /** daily, weekly, monthly summary */
  @Column({ default: 'daily' })
  granularity!: 'daily' | 'weekly' | 'monthly';
}
