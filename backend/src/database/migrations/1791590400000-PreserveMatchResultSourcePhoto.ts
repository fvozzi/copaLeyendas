import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreserveMatchResultSourcePhoto1791590400000 implements MigrationInterface {
  name = 'PreserveMatchResultSourcePhoto1791590400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "resultSourcePhotoStoredName" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN IF EXISTS "resultSourcePhotoStoredName"`);
  }
}
