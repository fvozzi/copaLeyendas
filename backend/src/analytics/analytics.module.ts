import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsController, PublicAnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsPageView } from './page-view.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsPageView]), AuthModule],
  controllers: [PublicAnalyticsController, AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
