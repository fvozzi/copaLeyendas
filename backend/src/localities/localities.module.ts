import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocalitiesController } from './localities.controller';
import { LocalitiesService } from './localities.service';
import { Locality } from './locality.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Locality])],
  controllers: [LocalitiesController],
  providers: [LocalitiesService],
  exports: [TypeOrmModule, LocalitiesService],
})
export class LocalitiesModule {}
