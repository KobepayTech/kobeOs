import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('hotel_room_signal_links')
export class HotelRoomSignalLink extends OwnedEntity {
  @Index()
  @Column('uuid')
  roomId!: string;

  @Index()
  @Column()
  roomNumber!: string;

  @Index()
  @Column()
  zoneId!: string;

  @Column({ default: true })
  active!: boolean;
}
