import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BoxingService } from './boxing.service';
import { BoutMethod } from './boxing.entity';

const METHODS = ['', 'KO', 'TKO', 'UD', 'SD', 'MD', 'DRAW', 'DQ', 'NC', 'RTD'];

class FighterDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() weightClass?: string;
  @IsOptional() @IsIn(['orthodox', 'southpaw']) stance?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsInt() reachCm?: number;
  @IsOptional() @IsInt() heightCm?: number;
  @IsOptional() @IsInt() @Min(0) wins?: number;
  @IsOptional() @IsInt() @Min(0) losses?: number;
  @IsOptional() @IsInt() @Min(0) draws?: number;
  @IsOptional() @IsInt() @Min(0) kos?: number;
  @IsOptional() @IsInt() ranking?: number;
  @IsOptional() @IsString() avatarUrl?: string;
}

class BoutDto {
  @IsUUID() fighterAId!: string;
  @IsUUID() fighterBId!: string;
  @IsOptional() @IsString() eventName?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() venue?: string;
  @IsOptional() @IsString() weightClass?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsInt() @Min(1) scheduledRounds?: number;
  @IsOptional() @IsIn(['MAIN', 'CO_MAIN', 'UNDERCARD']) cardPosition?: 'MAIN' | 'CO_MAIN' | 'UNDERCARD';
}

class ScoreDto {
  @IsInt() @Min(1) round!: number;
  @IsString() judge!: string;
  @IsNumber() @Min(0) a!: number;
  @IsNumber() @Min(0) b!: number;
}

class FinishDto {
  @IsIn(METHODS) method!: BoutMethod;
  @IsOptional() @IsUUID() winnerId?: string;
  @IsOptional() @IsInt() @Min(1) endRound?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('sports/boxing')
export class BoxingController {
  constructor(private readonly svc: BoxingService) {}

  @Get('fighters') listFighters(@CurrentUser('id') uid: string) { return this.svc.listFighters(uid); }
  @Post('fighters') createFighter(@CurrentUser('id') uid: string, @Body() dto: FighterDto) { return this.svc.createFighter(uid, dto); }
  @Patch('fighters/:id') updateFighter(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: Partial<FighterDto>) { return this.svc.updateFighter(uid, id, dto); }
  @Delete('fighters/:id') removeFighter(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.removeFighter(uid, id); }

  @Get('bouts') listBouts(@CurrentUser('id') uid: string, @Query('event') event?: string, @Query('status') status?: string) { return this.svc.listBouts(uid, { event, status }); }
  @Get('bouts/:id') getBout(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.getBout(uid, id); }
  @Post('bouts') createBout(@CurrentUser('id') uid: string, @Body() dto: BoutDto) { return this.svc.createBout(uid, dto as never); }
  @Patch('bouts/:id') updateBout(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: Partial<BoutDto>) { return this.svc.updateBout(uid, id, dto as never); }
  @Delete('bouts/:id') removeBout(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.removeBout(uid, id); }

  @Post('bouts/:id/score') score(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: ScoreDto) { return this.svc.scoreRound(uid, id, dto); }
  @Post('bouts/:id/finish') finish(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: FinishDto) { return this.svc.finish(uid, id, dto); }
}
