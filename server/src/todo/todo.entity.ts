import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('todo_lists')
export class TodoList extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '#3b82f6' })
  color!: string;
}

@Entity('todo_items')
export class TodoItem extends OwnedEntity {
  @Index()
  @Column('uuid')
  listId!: string;

  @Column()
  text!: string;

  @Column({ default: false })
  done!: boolean;

  @Column({ default: 'normal' })
  priority!: 'low' | 'normal' | 'high';

  @Column({ type: 'timestamptz', nullable: true })
  dueAt?: Date | null;
}
