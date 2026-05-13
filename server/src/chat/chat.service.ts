import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatChannel, ChatMessage } from './chat.entity';
import { CreateChannelDto, SendMessageDto } from './dto/chat.dto';
import { UsersService } from '../users/users.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatChannel) private readonly channels: Repository<ChatChannel>,
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
    private readonly users: UsersService,
    @Inject(forwardRef(() => ChatGateway)) private readonly gateway: ChatGateway,
  ) {}

  listChannels() {
    return this.channels.find({ order: { createdAt: 'ASC' } });
  }

  async createChannel(dto: CreateChannelDto) {
    const existing = await this.channels.findOne({ where: { slug: dto.slug } });
    if (existing) return existing;
    return this.channels.save(this.channels.create(dto));
  }

  async listMessages(channelId: string, limit = 200) {
    await this.assertChannel(channelId);
    return this.messages.find({
      where: { channelId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async sendMessage(senderId: string, dto: SendMessageDto) {
    await this.assertChannel(dto.channelId);
    const sender = await this.users.findById(senderId);
    if (!sender) throw new NotFoundException('Sender not found');
    const saved = await this.messages.save(
      this.messages.create({
        channelId: dto.channelId,
        senderId,
        senderName: sender.displayName || sender.email,
        text: dto.text,
        type: 'message',
      }),
    );
    this.gateway.broadcastMessage(saved);
    return saved;
  }

  private async assertChannel(channelId: string) {
    const ch = await this.channels.findOne({ where: { id: channelId } });
    if (!ch) throw new NotFoundException('Channel not found');
    return ch;
  }
}
