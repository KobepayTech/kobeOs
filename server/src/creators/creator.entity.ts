import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('creators')
export class Creator extends OwnedEntity {
  @Column()
  name!: string;

  @Index({ unique: false })
  @Column()
  handle!: string;

  @Column({ default: '' })
  niche!: string;

  @Column({ default: 0 })
  followers!: number;

  @Column({ type: 'float', default: 0 })
  engagement!: number;

  @Column({ nullable: true, type: 'varchar' })
  avatarUrl?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  contactEmail?: string | null;

  @Column({ type: 'simple-array', default: '' })
  platforms!: string[];

  @Column({ default: false })
  verified!: boolean;
}
