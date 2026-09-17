import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppDelivery, DeliveryStatus } from './whatsapp-delivery.entity';

const rank: Record<DeliveryStatus, number> = { accepted: 0, sent: 1, failed: 2, delivered: 3, read: 4 };

@Injectable()
export class WhatsAppDeliveryService {
  constructor(@InjectRepository(WhatsAppDelivery) private readonly deliveries: Repository<WhatsAppDelivery>) {}

  async record(messageId: string, status: DeliveryStatus, statusAt: Date, errorCode: number | null = null, errorMessage: string | null = null) {
    // A webhook can arrive before the send response. Preserve that row, and never
    // let duplicates or out-of-order notifications downgrade delivery/read confirmation.
    await this.deliveries.manager.transaction(async (manager) => {
      await manager.createQueryBuilder().insert().into(WhatsAppDelivery)
        .values({ messageId, status, statusAt, errorCode, errorMessage }).orIgnore().execute();
      const current = await manager.findOneOrFail(WhatsAppDelivery, { where: { messageId }, lock: { mode: 'pessimistic_write' } });
      if (rank[status] > rank[current.status] || (status === current.status && statusAt > current.statusAt)) {
        await manager.update(WhatsAppDelivery, { messageId }, { status, statusAt, errorCode: status === 'failed' ? errorCode : null, errorMessage: status === 'failed' ? errorMessage : null });
      }
    });
  }
}
