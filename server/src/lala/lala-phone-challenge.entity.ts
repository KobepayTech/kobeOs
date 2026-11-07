import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('lala_phone_challenges')
export class LalaPhoneChallenge {
  @PrimaryColumn() phone!: string;
  @Column() codeHash!: string;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ type: 'timestamptz' }) sentAt!: Date;
  @Column({ default: 0 }) attempts!: number;
  @Column({ type: 'varchar', nullable: true }) proofHash!: string | null;
}
