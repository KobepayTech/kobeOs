import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { PickTicketStatus } from '../pick-ticket.entity';

export class UpdatePickTicketStatusDto {
  @IsEnum(['PENDING', 'PICKING', 'PACKED', 'DISPATCHED', 'CANCELLED'])
  status!: PickTicketStatus;

  @IsOptional() @IsString() pickedBy?: string;
  @IsOptional() @IsString() note?: string;
}
