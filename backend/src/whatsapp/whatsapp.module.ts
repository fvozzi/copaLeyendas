import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsAppDelivery } from './whatsapp-delivery.entity';
import { WhatsAppDeliveryService } from './whatsapp-delivery.service';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsAppDelivery])],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppDeliveryService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
