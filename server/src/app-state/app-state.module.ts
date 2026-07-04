import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppState } from './app-state.entity';
import { AppStateService } from './app-state.service';
import { AppStateController } from './app-state.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppState])],
  providers: [AppStateService],
  controllers: [AppStateController],
  exports: [AppStateService],
})
export class AppStateModule {}
