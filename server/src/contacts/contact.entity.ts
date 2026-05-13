import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('contacts')
export class Contact extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ nullable: true, type: 'varchar' })
  email?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  phone?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  company?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  title?: string | null;

  @Column({ default: 'Friends' })
  group!: string;

  @Column({ default: false })
  favorite!: boolean;

  @Column({ type: 'text', default: '' })
  notes!: string;
}
