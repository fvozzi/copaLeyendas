import { Controller, Get, Param, ParseIntPipe, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { TournamentQueryService } from './tournament-query.service';

@Controller('public/tournaments')
export class PublicTournamentsController {
  constructor(private readonly tournaments: TournamentQueryService) {}

  @Get('current')
  current() {
    return this.tournaments.currentPublic();
  }

  @Get('current/map')
  map() {
    return this.tournaments.currentPublicMap();
  }

  @Get('matches/:id/photo')
  async matchPhoto(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) response: Response) {
    const file = await this.tournaments.publicMatchPhoto(id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Cache-Control', 'public, max-age=15');
    return new StreamableFile(file.content);
  }
}
