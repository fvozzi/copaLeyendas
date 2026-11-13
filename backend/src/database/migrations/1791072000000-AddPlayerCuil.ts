import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlayerCuil1791072000000 implements MigrationInterface {
  name = 'AddPlayerCuil1791072000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "players" ADD "cuil" character varying');
    await queryRunner.query('ALTER TABLE "players" ADD CONSTRAINT "UQ_players_cuil" UNIQUE ("cuil")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "players" DROP CONSTRAINT "UQ_players_cuil"');
    await queryRunner.query('ALTER TABLE "players" DROP COLUMN "cuil"');
  }
}
