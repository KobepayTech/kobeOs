import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordEntry } from './password.entity';
import { PasswordsService } from './passwords.service';
import { PasswordsController } from './passwords.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PasswordEntry])],
  providers: [PasswordsService],
  controllers: [PasswordsController],
})
export class PasswordsModule {}
