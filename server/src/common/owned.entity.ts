import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class OwnedEntity extends BaseEntity {
  @Index()
  @Column('uuid')
  ownerId!: string;
}
