import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('notes')
export class Note extends OwnedEntity {
  @Column({ default: '' })
  title!: string;

  @Column({ type: 'text', default: '' })
  body!: string;

  @Column({ type: 'simple-array', default: '' })
  tags!: string[];

  @Column({ default: false })
  pinned!: boolean;

  @Column({ default: '#fde68a' })
  color!: string;
}
