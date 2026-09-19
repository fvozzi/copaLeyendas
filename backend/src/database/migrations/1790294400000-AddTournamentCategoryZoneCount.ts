import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTournamentCategoryZoneCount1790294400000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "tournament_categories" ADD "zoneCount" integer');
    await runner.query('ALTER TABLE "tournament_categories" ADD CONSTRAINT "tournament_categories_zone_count" CHECK ("zoneCount" BETWEEN 1 AND 26)');
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "tournament_categories" DROP CONSTRAINT "tournament_categories_zone_count"');
    await runner.query('ALTER TABLE "tournament_categories" DROP COLUMN "zoneCount"');
  }
}
