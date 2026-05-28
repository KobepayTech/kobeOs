import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('security_clients')
export class SecurityClient extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ nullable: true, type: 'varchar' })
  contactName?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  contactPhone?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  registrationNumber?: string | null;

  @Column({ default: true })
  active!: boolean;
}
