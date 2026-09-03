import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PairRegistration } from './pair-registration.entity';
import { PublicRegistrationsController } from './public-registrations.controller';
import { RegistrationAccessGrant } from './registration-access-grant.entity';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { Locality } from '../localities/locality.entity';
import { PlayersModule } from '../players/players.module';
import { GoogleDrivePhotoStorageService } from './google-drive-photo-storage.service';
import { Tournament } from '../tournaments/tournament.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PairRegistration, RegistrationAccessGrant, Locality, Tournament]), PlayersModule],
  controllers: [RegistrationsController, PublicRegistrationsController],
  providers: [RegistrationsService, GoogleDrivePhotoStorageService],
  exports: [RegistrationsService, TypeOrmModule],
})
export class RegistrationsModule {}
