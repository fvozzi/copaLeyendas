import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DirectorGuard } from '../auth/director.guard';
import { CreatePlayerDto } from './dto/create-player.dto';
import { QueryPlayersDto } from './dto/query-players.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayersService } from './players.service';

@Controller('players')
@UseGuards(JwtAuthGuard, DirectorGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}
  @Get() list(@Query() query: QueryPlayersDto) { return this.playersService.list(query); }
  @Get('export/:kind')
  async export(@Param('kind') kind: string, @Res() response: Response) {
    const file = await this.playersService.export(kind);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.send(`\uFEFF${file.content}`);
  }
  @Get(':id') getById(@Param('id', ParseIntPipe) id: number) { return this.playersService.getById(id); }
  @Get(':id/photo')
  async photo(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) response: Response) {
    const file = await this.playersService.getPhoto(id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return file.stream;
  }
  @Post() create(@Body() dto: CreatePlayerDto) { return this.playersService.create(dto); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlayerDto) { return this.playersService.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.playersService.remove(id); }
}
