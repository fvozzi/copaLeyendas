import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type DeliveryStatus = 'accepted' | 'sent' | 'delivered' | 'read' | 'failed';

@Entity('whatsapp_deliveries')
export class WhatsAppDelivery {
  @PrimaryColumn({ type: 'varchar' }) messageId: string;
  @Column({ type: 'varchar' }) status: DeliveryStatus;
  @Column({ type: 'timestamptz' }) statusAt: Date;
  @Column({ type: 'integer', nullable: true }) errorCode: number | null;
  @Column({ type: 'text', nullable: true }) errorMessage: string | null;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
