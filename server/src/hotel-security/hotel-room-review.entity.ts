import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('hotel_room_reviews')
export class HotelRoomReview extends OwnedEntity {
  @Index()
  @Column('uuid')
  roomId!: string;

  @Index()
  @Column()
  roomNumber!: string;

  @Column({ default: 'normal' })
  risk!: 'normal' | 'watch' | 'high' | 'critical';

  @Column({ default: 'open' })
  state!: 'open' | 'reviewing' | 'resolved' | 'closed';

  @Column({ default: '' })
  title!: string;

  @Column({ default: '' })
  summary!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  snapshot!: Record<string, unknown>;
}
