import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SearchService } from './search.service';

class SearchDto {
  @IsString() @MaxLength(500) q!: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsString() @MaxLength(20) kind?: string;
}

@ApiTags('AI / Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Post()
  @ApiOperation({ summary: 'Semantic search across products, tenants and reviews' })
  search(@CurrentUser('id') uid: string, @Body() dto: SearchDto) {
    return this.svc.search(uid, dto.q, dto.limit ?? 10, dto.kind);
  }

  @Post('reindex')
  @ApiOperation({ summary: 'Rebuild the semantic search index for this owner' })
  reindex(@CurrentUser('id') uid: string) {
    return this.svc.reindex(uid);
  }
}
