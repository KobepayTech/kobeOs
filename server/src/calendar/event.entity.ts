import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('calendar_events')
export class CalendarEvent extends OwnedEntity {
  @Column()
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'timestamptz' })
  startAt!: Date;

  @Column({ type: 'timestamptz' })
  endAt!: Date;

  @Column({ default: false })
  allDay!: boolean;

  @Column({ default: '#3b82f6' })
  color!: string;

  @Column({ nullable: true, type: 'varchar' })
  location?: string | null;
}
