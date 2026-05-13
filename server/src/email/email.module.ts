import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailMessage } from './email.entity';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailMessage])],
  providers: [EmailService],
  controllers: [EmailController],
})
export class EmailModule {}
