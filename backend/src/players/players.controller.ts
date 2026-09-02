import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  @Get(':id') getById(@Param('id', ParseIntPipe) id: number) { return this.playersService.getById(id); }
  @Post() create(@Body() dto: CreatePlayerDto) { return this.playersService.create(dto); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlayerDto) { return this.playersService.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.playersService.remove(id); }
}
