import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTournamentZoneCapacities1791158400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tournament_categories" ADD "zoneCapacities" integer array');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tournament_categories" DROP COLUMN "zoneCapacities"');
  }
}
