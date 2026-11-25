import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityCourtContactDetails1792627200000 implements MigrationInterface {
  name = 'AddCommunityCourtContactDetails1792627200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "contactName" character varying(120)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "contactPhone" character varying(40)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "contactEmail" character varying(160)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "contactUrl" character varying(300)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "contactUrl"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "contactEmail"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "contactPhone"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "contactName"');
  }
}
