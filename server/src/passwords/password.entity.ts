import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('password_entries')
export class PasswordEntry extends OwnedEntity {
  @Column()
  title!: string;

  @Column({ nullable: true, type: 'varchar' })
  url?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  username?: string | null;

  /** Ciphertext blob (client-side encrypted) */
  @Column({ type: 'text' })
  cipher!: string;

  @Column({ default: '' })
  category!: string;

  @Column({ default: false })
  favorite!: boolean;
}
