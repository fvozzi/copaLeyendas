import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackWhatsAppAndTokenUsage1789776000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "registration_access_grants" ADD "whatsappSentAt" timestamptz');
    // A saved registration consumes its token even if player synchronization failed later.
    await queryRunner.query(`
      UPDATE "registration_access_grants" AS g
      SET "status" = 'USED', "consumedAt" = COALESCE(g."consumedAt", r."registeredAt")
      FROM (
        SELECT "accessGrantId", MIN("createdAt") AS "registeredAt"
        FROM "pair_registrations" GROUP BY "accessGrantId"
      ) AS r
      WHERE g."id" = r."accessGrantId" AND g."status" = 'ACTIVE'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "registration_access_grants" DROP COLUMN "whatsappSentAt"');
  }
}
