import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('studio_media_projects')
export class StudioMediaProject extends OwnedEntity {
  @Column()
  title!: string;

  @Column({ default: 'media-studios' })
  section!: 'media-studios' | 'creator-marketplace' | 'brand-studio' | 'football-analytics';

  @Column({ default: 'short-video' })
  format!: 'short-video' | 'ad-video' | 'creator-package' | 'product-video' | 'match-analysis';

  @Column({ default: 'English' })
  language!: string;

  @Column({ default: 'draft' })
  status!: 'draft' | 'generating' | 'ready' | 'published' | 'failed';

  @Column({ default: 'MoneyPrinterTurbo' })
  engine!: string;

  @Column({ default: '' })
  prompt!: string;

  @Column({ nullable: true, type: 'varchar' })
  outputUrl?: string | null;

  @Index()
  @Column({ nullable: true, type: 'uuid' })
  companyId?: string | null;
}
