import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/** Customer product review / rating shown on the public storefront. */
@Entity('product_reviews')
@Index(['ownerId', 'productId'])
export class ProductReview extends OwnedEntity {
  @Column('uuid') productId!: string;
  @Column({ type: 'int', default: 5 }) rating!: number; // 1..5
  @Column({ default: '' }) title!: string;
  @Column({ type: 'text', default: '' }) comment!: string;
  @Column({ default: 'Customer' }) customerName!: string;
  @Column({ nullable: true, type: 'varchar' }) customerPhone?: string | null;
  @Column({ default: true }) approved!: boolean;
}
