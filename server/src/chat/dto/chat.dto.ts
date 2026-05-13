import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateChannelDto {
  @IsString() @MaxLength(60) slug!: string;
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(280) description?: string;
  @IsOptional() @IsEnum(['channel', 'dm']) type?: 'channel' | 'dm';
}

export class SendMessageDto {
  @IsUUID() channelId!: string;
  @IsString() @MaxLength(4000) text!: string;
}
