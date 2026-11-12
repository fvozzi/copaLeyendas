import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../auth/user.entity';
import { TournamentQueryService } from './tournament-query.service';
import { TournamentStatus } from './tournament.enums';
import { TournamentsService } from './tournaments.service';
import { ProgramScenarioDto } from './program-scenario.dto';
import { TournamentVenuePdfService } from './tournament-venue-pdf.service';

class ScheduleMatchDto { @IsDateString() scheduledAt: string; }
class ResultDto { @IsInt() homeScore: number; @IsInt() awayScore: number; }
class AssignPlaceDto { @IsInt() @Min(1) registrationId: number; }
class ApplyDistributionDto { @IsString() baseVersion: string; @IsOptional() @IsBoolean() resetProgram?: boolean; }
class DistributionVenueDto { @IsInt() @Min(1) tournamentCategoryId: number; @IsInt() @Min(0) zoneIndex: number; @IsInt() @Min(1) venueId: number; }
class AttendanceDto { @IsBoolean() present: boolean; }

@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private s: TournamentsService, private q: TournamentQueryService, private venuePdf: TournamentVenuePdfService) {}
  @Get() list() { return this.s.list(); }
  @Get('operations') operations(@CurrentUser() user: AuthenticatedUser) { return this.s.operations(user); }
  @Get('zones/:id') async zone(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { await this.s.assertZoneAccess(user, id); return this.q.zone(id); }
  @Get('categories/:id/registrations') registrations(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.q.availableRegistrations(id); }
  @Get('categories/:id/registration-placements') registrationPlacements(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.q.registrationPlacements(id); }
  @Get('zones/:id/matches') async matches(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { await this.s.assertZoneAccess(user, id); return this.s.matches(id); }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.q.detail(id); }
  @Get(':id/distribution') distribution(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.s.distributionPreview(id); }
  @Patch(':id/distribution/venue') distributionVenue(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: DistributionVenueDto) { this.assertDirector(user); return this.s.setDistributionVenue(id, dto); }
  @Post(':id/distribution/apply') applyDistribution(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ApplyDistributionDto) { this.assertDirector(user); return this.s.applyDistribution(id, dto.baseVersion, dto.resetProgram ?? false); }
  @Patch(':id/attendance/:registrationId') attendance(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Param('registrationId', ParseIntPipe) registrationId: number, @Body() dto: AttendanceDto) { this.assertDirector(user); return this.s.setAttendance(id, registrationId, dto.present); }
  @Get(':id/schedule-grid') scheduleGrid(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.s.scheduleGrid(id); }
  @Get(':id/venues/:venueId/worksheet.pdf')
  async venueWorksheet(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Param('venueId', ParseIntPipe) venueId: number, @Res({ passthrough: true }) response: Response) {
    this.assertDirector(user);
    const file = await this.venuePdf.generate(id, venueId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(file.buffer);
  }
  @Post(':id/redistribute-courts') redistributeCourts(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.s.redistributeCourts(id); }
  @Post(':id/program-scenario/preview') previewScenario(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ProgramScenarioDto) { this.assertDirector(user); return this.s.scenario(id, dto); }
  @Post(':id/program-scenario/apply') applyScenario(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ProgramScenarioDto) { this.assertDirector(user); return this.s.scenario(id, dto, true); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: { name: string; startsAt?: string; endsAt?: string; playingDays?: string[]; city?: string }) { this.assertDirector(user); return this.s.create(dto); }
  @Patch(':id') update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: { name?: string; startsAt?: string; endsAt?: string; playingDays?: string[]; city?: string; status?: TournamentStatus }) { this.assertDirector(user); return this.s.update(id, dto); }
  @Post(':id/categories') category(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: { categoryId: number; pointsPerSet?: number; setsToWin?: number; zoneSize?: number; zoneCount?: number | null }) { this.assertDirector(user); return this.s.addCategory(id, dto); }
  @Patch('categories/:id') updateCategory(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: { pointsPerSet?: number; setsToWin?: number; zoneSize?: number; zoneCount?: number | null; registrationsOpen?: boolean }) { this.assertDirector(user); return this.s.updateCategory(id, dto); }
  @Post('zones') createZone(@CurrentUser() user: AuthenticatedUser, @Body() dto: { tournamentCategoryId: number; venueId: number; name: string; capacity: number }) { this.assertDirector(user); return this.s.createZone(dto); }
  @Patch('zones/:id') updateZone(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: { name?: string; venueId?: number; capacity?: number }) { this.assertDirector(user); return this.s.updateZone(id, dto); }
  @Delete('zones/:id') removeZone(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.s.removeZone(id); }
  @Post('categories/:id/divide-zones') divideZones(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.s.divideZones(id); }
  @Patch('schedule-slots/:id') scheduleSlot(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: { scheduledAt?: string | null; courtId?: number | null }) { this.assertDirector(user); return this.s.updateScheduleSlot(id, dto); }
  @Post('zones/:id/entries') entry(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: { registrationId: number }) { this.assertDirector(user); return this.s.addEntry(id, dto.registrationId); }
  @Post('zones/:id/fixture') fixture(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.s.fixture(id); }
  @Patch('zones/:id/places/:seed') place(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Param('seed', ParseIntPipe) seed: number, @Body() dto: AssignPlaceDto) { this.assertDirector(user); return this.s.assignPlace(id, dto.registrationId, seed); }
  @Patch('matches/:id/schedule') schedule(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ScheduleMatchDto) { return this.s.schedule(id, dto.scheduledAt, user); }
  @Post('matches/:id/result')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  result(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ResultDto, @UploadedFile() photo?: Express.Multer.File) {
    if (!photo) throw new BadRequestException('La foto del resultado es obligatoria.');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(photo.mimetype)) throw new BadRequestException('La foto debe ser JPG, PNG, WebP, HEIC o HEIF.');
    return this.s.result(id, dto.homeScore, dto.awayScore, user, photo);
  }
  @Get('matches/:id/result-photo')
  async resultPhoto(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) response: Response) {
    const file = await this.s.resultPhoto(id, user);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    response.setHeader('Cache-Control', 'private, max-age=300');
    return file.content;
  }
  private assertDirector(user: AuthenticatedUser) { if (user.role !== UserRole.DIRECTOR) throw new ForbiddenException('Solo Direccion puede configurar el torneo.'); }
}
