import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatChannel, ChatMessage } from './chat.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChatChannel, ChatMessage]), UsersModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
