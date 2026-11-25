import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityCourtCommonDetails1792368000000 implements MigrationInterface {
  name = 'AddCommunityCourtCommonDetails1792368000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "frontisFinish" character varying(10)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "courtColor" character varying(10)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "history" text');
    await queryRunner.query(`ALTER TABLE "community_courts" ADD CONSTRAINT "CHK_community_frontis_finish" CHECK ("frontisFinish" IS NULL OR "frontisFinish" IN ('HARD', 'MARBLE'))`);
    await queryRunner.query(`ALTER TABLE "community_courts" ADD CONSTRAINT "CHK_community_court_color" CHECK ("courtColor" IS NULL OR "courtColor" IN ('WHITE', 'BLUE', 'GREEN', 'GRAY'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" DROP CONSTRAINT "CHK_community_court_color"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP CONSTRAINT "CHK_community_frontis_finish"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "history"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "courtColor"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "frontisFinish"');
  }
}
