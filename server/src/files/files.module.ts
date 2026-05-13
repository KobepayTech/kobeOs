import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FsNode } from './file.entity';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FsNode])],
  providers: [FilesService],
  controllers: [FilesController],
})
export class FilesModule {}
