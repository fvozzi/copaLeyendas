import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentPost } from '../posts/content-post.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContentPost, PairRegistration, RegistrationAccessGrant])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
