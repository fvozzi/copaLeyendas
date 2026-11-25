import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityCourtPlayerGroup } from './community-court-player-group.entity';
import { CommunityCourt } from './community-court.entity';
import { CommunityCourtPhoto } from './community-court-photo.entity';
import { CourtDirectoryController } from './court-directory.controller';
import { CourtDirectoryService } from './court-directory.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommunityCourt, CommunityCourtPlayerGroup, CommunityCourtPhoto])],
  controllers: [CourtDirectoryController],
  providers: [CourtDirectoryService],
})
export class CourtDirectoryModule {}
