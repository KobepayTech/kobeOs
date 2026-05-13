import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('kanban_boards')
export class KanbanBoard extends OwnedEntity {
  @Column()
  name!: string;
}

@Entity('kanban_columns')
export class KanbanColumn extends OwnedEntity {
  @Index()
  @Column('uuid')
  boardId!: string;

  @Column()
  title!: string;

  @Column({ default: 0 })
  position!: number;

  @Column({ default: '#64748b' })
  color!: string;
}

@Entity('kanban_cards')
export class KanbanCard extends OwnedEntity {
  @Index()
  @Column('uuid')
  columnId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ default: 0 })
  position!: number;

  @Column({ type: 'simple-array', default: '' })
  labels!: string[];

  @Column({ default: 'medium' })
  priority!: 'low' | 'medium' | 'high';

  @Column({ nullable: true, type: 'varchar' })
  colorTag?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt?: Date | null;
}
