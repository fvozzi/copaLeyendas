import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { DirectorGuard } from '../auth/director.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupsService } from './backups.service';
import { UpdateBackupSettingsDto } from './update-backup-settings.dto';

@Controller('backups')
@UseGuards(JwtAuthGuard, DirectorGuard)
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}
  @Get() overview() { return this.backups.overview(); }
  @Patch('settings') update(@Body() dto: UpdateBackupSettingsDto) { return this.backups.updateSettings(dto); }
  @Post() @HttpCode(202)
  create(@CurrentUser() user: AuthenticatedUser) { return this.backups.start('MANUAL', user.name); }
  @Get(':id/download')
  async download(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) response: Response) {
    const file = await this.backups.download(id);
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return file.stream;
  }
}
