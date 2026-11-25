import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityCourtInaugurationDate1792540800000 implements MigrationInterface {
  name = 'AddCommunityCourtInaugurationDate1792540800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "inaugurationDate" date');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "inaugurationDate"');
  }
}
