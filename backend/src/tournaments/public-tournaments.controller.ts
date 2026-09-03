import { Controller, Get } from '@nestjs/common';
import { TournamentQueryService } from './tournament-query.service';

@Controller('public/tournaments')
export class PublicTournamentsController {
  constructor(private readonly tournaments: TournamentQueryService) {}

  @Get('current')
  current() {
    return this.tournaments.currentPublic();
  }
}
