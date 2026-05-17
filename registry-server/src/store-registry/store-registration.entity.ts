import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('store_registrations')
export class StoreRegistration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  slug!: string;

  @Column()
  serverIp!: string;

  @Column({ default: 3000 })
  serverPort!: number;

  @Column({ nullable: true, type: 'varchar' })
  cfRecordId!: string | null;

  @Column({ default: 'active' })
  status!: string;

  @Column({ nullable: true, type: 'timestamptz' })
  lastSeenAt!: Date | null;

  @Column()
  ownerId!: string;

  @Column({ default: '' })
  storeName!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
