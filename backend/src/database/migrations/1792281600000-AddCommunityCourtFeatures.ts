import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityCourtFeatures1792281600000 implements MigrationInterface {
  name = 'AddCommunityCourtFeatures1792281600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "courtType" character varying(12)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "trinquetShareMaterial" character varying(12)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "trinquetShareMaterialOther" character varying(100)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "frontonWallOrientation" character varying(12)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "frontonHasCacerola" boolean');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "frontonBackType" character varying(12)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "frontonReboundMaterial" character varying(100)');
    await queryRunner.query(`ALTER TABLE "community_courts" ADD CONSTRAINT "CHK_community_court_type" CHECK ("courtType" IS NULL OR "courtType" IN ('TRINQUET', 'FRONTON'))`);
    await queryRunner.query(`ALTER TABLE "community_courts" ADD CONSTRAINT "CHK_community_share_material" CHECK ("trinquetShareMaterial" IS NULL OR "trinquetShareMaterial" IN ('WOOD', 'MASONRY', 'OTHER'))`);
    await queryRunner.query(`ALTER TABLE "community_courts" ADD CONSTRAINT "CHK_community_wall_orientation" CHECK ("frontonWallOrientation" IS NULL OR "frontonWallOrientation" IN ('LEFT_LONG', 'RIGHT_LONG'))`);
    await queryRunner.query(`ALTER TABLE "community_courts" ADD CONSTRAINT "CHK_community_back_type" CHECK ("frontonBackType" IS NULL OR "frontonBackType" IN ('REBOUND', 'FREE_LIFT'))`);
    await queryRunner.query('CREATE INDEX "IDX_community_courts_type" ON "community_courts" ("courtType")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_community_courts_type"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP CONSTRAINT "CHK_community_back_type"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP CONSTRAINT "CHK_community_wall_orientation"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP CONSTRAINT "CHK_community_share_material"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP CONSTRAINT "CHK_community_court_type"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "frontonReboundMaterial"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "frontonBackType"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "frontonHasCacerola"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "frontonWallOrientation"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "trinquetShareMaterialOther"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "trinquetShareMaterial"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "courtType"');
  }
}
