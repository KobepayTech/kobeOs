import {
  Body, Controller, Get, Param, Post, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsIn, IsObject, IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { IntakeService } from './intake.service';
import { INTAKE_KINDS, MAX_IMAGES_PER_SESSION } from './intake.rules';

class AnswerDto {
  @IsObject() answers!: Record<string, unknown>;
}

class StartDto {
  @IsIn(INTAKE_KINDS as unknown as string[]) kind!: string;
  /** The business or hotel the entries belong to; omitted on a single-shop install. */
  @IsOptional() @IsUUID() contextId?: string;
}

/**
 * Guided catalogue intake.
 *
 * Upload a batch of photos, then answer two or three questions per photo with
 * the photo in front of you. Every answer creates a real catalogue entry
 * through the existing single-item path.
 */
@Controller('intake')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  /** Batches still part-way through, so a reload can pick one up again. */
  @Get('sessions')
  sessions(@CurrentUser('id') uid: string) {
    return this.intake.openSessions(uid);
  }

  /**
   * Upload the batch and get the first question.
   *
   * The file limit matches the queue cap: a bigger batch is refused here
   * rather than silently truncated, because a merchant who uploaded 200
   * photos and got 120 would not know which eighty were missing.
   */
  @Post('sessions')
  @UseInterceptors(FilesInterceptor('images', MAX_IMAGES_PER_SESSION, {
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  start(
    @CurrentUser('id') uid: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: StartDto,
  ) {
    return this.intake.start(uid, body?.kind, files ?? [], body?.contextId);
  }

  /** The current question for a batch. */
  @Get('sessions/:id')
  step(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.intake.step(uid, id);
  }

  /** Answer the current photo; the response carries the next one. */
  @Post('items/:itemId/answer')
  answer(
    @CurrentUser('id') uid: string,
    @Param('itemId') itemId: string,
    @Body() dto: AnswerDto,
  ) {
    return this.intake.answer(uid, itemId, dto?.answers ?? {});
  }

  @Post('items/:itemId/skip')
  skip(@CurrentUser('id') uid: string, @Param('itemId') itemId: string) {
    return this.intake.skip(uid, itemId);
  }

  /** Put a skipped or failed photo back in the queue. */
  @Post('items/:itemId/retry')
  retry(@CurrentUser('id') uid: string, @Param('itemId') itemId: string) {
    return this.intake.retry(uid, itemId);
  }
}
