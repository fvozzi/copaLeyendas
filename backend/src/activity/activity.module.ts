import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ActivityController } from './activity.controller';
import { ActivityLog } from './activity-log.entity';
import { ActivityInterceptor } from './activity.interceptor';
import { ActivityService } from './activity.service';
import { HttpExceptionLogFilter } from './http-exception.filter';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog]), AuthModule],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionLogFilter },
  ],
})
export class ActivityModule {}
