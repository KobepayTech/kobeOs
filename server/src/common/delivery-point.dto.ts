import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class DeliveryPointDto {
  @IsNumber() @IsLatitude() latitude!: number;
  @IsNumber() @IsLongitude() longitude!: number;
}
