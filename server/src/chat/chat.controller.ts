import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatService } from './chat.service';
import { CreateChannelDto, SendMessageDto } from './dto/chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly svc: ChatService) {}

  @Get('channels') listChannels() { return this.svc.listChannels(); }
  @Post('channels') createChannel(@Body() dto: CreateChannelDto) { return this.svc.createChannel(dto); }

  @Get('channels/:id/messages')
  listMessages(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.svc.listMessages(id, limit ? Number(limit) : undefined);
  }

  @Post('messages')
  send(@CurrentUser('id') uid: string, @Body() dto: SendMessageDto) {
    return this.svc.sendMessage(uid, dto);
  }
}
