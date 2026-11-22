import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCleanMatchPhoto1791849600000 implements MigrationInterface {
  name = 'AddCleanMatchPhoto1791849600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "resultCleanPhotoStoredName" character varying');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tournament_matches" DROP COLUMN IF EXISTS "resultCleanPhotoStoredName"');
  }
}
