import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTournamentDriveFolder1789084800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> { await queryRunner.query('ALTER TABLE "tournaments" ADD "driveFolderId" character varying'); }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query('ALTER TABLE "tournaments" DROP COLUMN "driveFolderId"'); }
}
