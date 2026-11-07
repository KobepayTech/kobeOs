import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('property_listings')
@Index('idx_property_listings_public', ['published', 'createdAt'])
export class PropertyListing extends OwnedEntity {
  @Column() title!: string;
  @Column() kind!: string;
  @Column() offer!: 'RENT' | 'SALE';
  @Column({ type: 'decimal', precision: 18, scale: 2 }) price!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column() location!: string;
  @Column({ type: 'int', nullable: true }) bedrooms?: number | null;
  @Column({ type: 'int', nullable: true }) bathrooms?: number | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) areaM2?: number | null;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'jsonb', default: [] }) amenities!: string[];
  @Column({ default: '' }) contactPhone!: string;
  @Column({ type: 'jsonb', default: [] }) imageUrls!: string[];
  @Column({ default: false }) published!: boolean;
}
