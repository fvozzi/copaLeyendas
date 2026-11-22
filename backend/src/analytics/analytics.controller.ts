import { Body, Controller, Get, Headers, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { DirectorGuard } from '../auth/director.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { RecordPageViewDto } from './analytics.dto';

@Controller('public/analytics')
export class PublicAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('page-view')
  @HttpCode(204)
  async record(@Body() dto: RecordPageViewDto, @Headers('user-agent') userAgent?: string) {
    await this.analytics.record(dto, userAgent);
  }
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, DirectorGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@Query('days') days?: string) {
    return this.analytics.summary(days);
  }
}
