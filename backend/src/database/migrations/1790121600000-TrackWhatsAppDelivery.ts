import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackWhatsAppDelivery1790121600000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "whatsapp_deliveries" (
      "messageId" varchar PRIMARY KEY, "status" varchar NOT NULL, "statusAt" timestamptz NOT NULL,
      "errorCode" integer, "errorMessage" text, "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query('ALTER TABLE "registration_access_grants" ADD "whatsappMessageId" varchar');
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "registration_access_grants" DROP COLUMN "whatsappMessageId"');
    await runner.query('DROP TABLE "whatsapp_deliveries"');
  }
}
