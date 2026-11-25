import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateCommunityCourtDto, QueryCommunityCourtsDto } from './court-directory.dto';
import { CourtDirectoryService } from './court-directory.service';

@Controller('public/court-directory')
export class CourtDirectoryController {
  constructor(private readonly directory: CourtDirectoryService) {}

  @Get()
  list(@Query() query: QueryCommunityCourtsDto) {
    return this.directory.list(query);
  }

  @Post()
  create(@Body() dto: CreateCommunityCourtDto) {
    return this.directory.create(dto);
  }
}
