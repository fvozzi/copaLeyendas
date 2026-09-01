import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Locality } from '../localities/locality.entity';
import { Player } from './player.entity';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';

@Module({
  imports: [TypeOrmModule.forFeature([Player, Locality])],
  controllers: [PlayersController],
  providers: [PlayersService],
})
export class PlayersModule {}
