import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Locality } from '../localities/locality.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { Player } from './player.entity';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { GoogleDrivePhotoStorageService } from '../registrations/google-drive-photo-storage.service';
import { Tournament } from '../tournaments/tournament.entity';
import { Zone } from '../tournaments/zone.entity';
import { ZoneEntry } from '../tournaments/zone-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Player, Locality, PairRegistration, Tournament, Zone, ZoneEntry])],
  controllers: [PlayersController],
  providers: [PlayersService, GoogleDrivePhotoStorageService],
  exports: [PlayersService],
})
export class PlayersModule {}
