import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Creator } from './creator.entity';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Creator])],
  providers: [CreatorsService],
  controllers: [CreatorsController],
})
export class CreatorsModule {}
