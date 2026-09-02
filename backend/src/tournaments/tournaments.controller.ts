import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsDateString, IsInt } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../auth/user.entity';
import { TournamentQueryService } from './tournament-query.service';
import { TournamentsService } from './tournaments.service';

class ScheduleMatchDto { @IsDateString() scheduledAt: string; }
class ResultDto { @IsInt() homeScore: number; @IsInt() awayScore: number; }

@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private s: TournamentsService, private q: TournamentQueryService) {}
  @Get() list() { return this.s.list(); }
  @Get('zones/:id') async zone(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { await this.s.assertZoneAccess(user, id); return this.q.zone(id); }
  @Get('categories/:id/registrations') registrations(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.q.availableRegistrations(id); }
  @Get('zones/:id/matches') async matches(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { await this.s.assertZoneAccess(user, id); return this.s.matches(id); }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.q.detail(id); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: { name: string; startsAt?: string; endsAt?: string; city?: string }) { this.assertDirector(user); return this.s.create(dto); }
  @Post(':id/categories') category(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: { categoryId: number; pointsPerSet?: number; setsToWin?: number; zoneSize?: number }) { this.assertDirector(user); return this.s.addCategory(id, dto); }
  @Post('zones') createZone(@CurrentUser() user: AuthenticatedUser, @Body() dto: { tournamentCategoryId: number; courtId: number; name: string; capacity: number }) { this.assertDirector(user); return this.s.createZone(dto); }
  @Post('zones/:id/entries') entry(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: { registrationId: number }) { this.assertDirector(user); return this.s.addEntry(id, dto.registrationId); }
  @Post('zones/:id/fixture') fixture(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.s.fixture(id); }
  @Patch('matches/:id/schedule') schedule(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ScheduleMatchDto) { return this.s.schedule(id, dto.scheduledAt, user); }
  @Post('matches/:id/result') result(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ResultDto) { return this.s.result(id, dto.homeScore, dto.awayScore, user); }
  private assertDirector(user: AuthenticatedUser) { if (user.role !== UserRole.DIRECTOR) throw new ForbiddenException('Solo Direccion puede configurar el torneo.'); }
}
