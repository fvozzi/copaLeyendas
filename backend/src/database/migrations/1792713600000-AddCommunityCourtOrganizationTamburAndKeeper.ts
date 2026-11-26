import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityCourtOrganizationTamburAndKeeper1792713600000 implements MigrationInterface {
  name = 'AddCommunityCourtOrganizationTamburAndKeeper1792713600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "organizationType" character varying(32)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "frontonTambur" character varying(16)');
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "hasCourtKeeper" boolean NOT NULL DEFAULT false');
    await queryRunner.query(`ALTER TABLE "community_courts" ADD CONSTRAINT "CHK_community_organization_type" CHECK ("organizationType" IS NULL OR "organizationType" IN ('CLUB', 'ASSOCIATION', 'PRIVATE_ESTABLISHMENT', 'EDUCATIONAL_INSTITUTION', 'MUNICIPAL_PUBLIC', 'UNION_MUTUAL', 'NEIGHBORHOOD_CENTER', 'OTHER'))`);
    await queryRunner.query(`ALTER TABLE "community_courts" ADD CONSTRAINT "CHK_community_fronton_tambur" CHECK ("frontonTambur" IS NULL OR "frontonTambur" IN ('LEFT', 'RIGHT', 'BOTH', 'NONE'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" DROP CONSTRAINT "CHK_community_fronton_tambur"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP CONSTRAINT "CHK_community_organization_type"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "hasCourtKeeper"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "frontonTambur"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "organizationType"');
  }
}
