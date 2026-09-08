import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentPost } from '../posts/content-post.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { Tournament } from '../tournaments/tournament.entity';
import { Zone } from '../tournaments/zone.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Category } from '../categories/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContentPost, PairRegistration, RegistrationAccessGrant, Tournament, Zone, Category])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
