import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DirectorGuard } from '../auth/director.guard';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { QueryLocalitiesDto } from './dto/query-localities.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';
import { LocalitiesService } from './localities.service';

@Controller('localities')
@UseGuards(JwtAuthGuard, DirectorGuard)
export class LocalitiesController {
  constructor(private readonly localitiesService: LocalitiesService) {}

  @Get()
  list(@Query() query: QueryLocalitiesDto) { return this.localitiesService.list(query); }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) { return this.localitiesService.getById(id); }

  @Post()
  create(@Body() dto: CreateLocalityDto) { return this.localitiesService.create(dto); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLocalityDto) {
    return this.localitiesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.localitiesService.remove(id); }
}
