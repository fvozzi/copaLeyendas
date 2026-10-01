import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DirectorGuard } from '../auth/director.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivityService } from './activity.service';

@Controller('activity')
@UseGuards(JwtAuthGuard, DirectorGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('level') level?: string,
    @Query('method') method?: string,
    @Query('search') search?: string,
  ) {
    return this.activity.list({ page, pageSize, level, method, search });
  }
}
