import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocalitiesController } from './localities.controller';
import { LocalitiesService } from './localities.service';
import { Locality } from './locality.entity';
import { Category } from '../categories/category.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Locality, Category, RegistrationAccessGrant, PairRegistration])],
  controllers: [LocalitiesController],
  providers: [LocalitiesService],
  exports: [TypeOrmModule, LocalitiesService],
})
export class LocalitiesModule {}
