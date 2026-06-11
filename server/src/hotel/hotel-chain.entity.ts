import { Entity, Column, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('hotel_chains')
export class HotelChain extends OwnedEntity {
  @Index({ unique: true })
  @Column()
  slug!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ default: 'TZS' })
  currency!: string;

  /** Brand color hex for theming */
  @Column({ nullable: true, default: '#7B8CDE' })
  brandColor?: string;

  @Column({ default: true })
  isActive!: boolean;
}
