import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Visual placement metadata is kept separate from the financial PropertyUnit
 * record. This lets the corridor/floor planner evolve without changing rent,
 * leases, or payment history.
 */
@Entity('property_unit_layouts')
@Index(['ownerId', 'unitId'], { unique: true })
export class PropertyUnitLayout extends OwnedEntity {
  @Index()
  @Column('uuid')
  propertyId!: string;

  @Column('uuid')
  unitId!: string;

  @Column({ default: 'Ground' })
  floor!: string;

  @Column({ default: 'Main corridor' })
  corridor!: string;

  @Column({ default: 'single' })
  corridorSide!: 'left' | 'right' | 'end' | 'single';

  @Column({ type: 'int', default: 0 })
  position!: number;
}
