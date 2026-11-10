import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZoneVenuePlanning1790899200000 implements MigrationInterface {
  name = 'AddZoneVenuePlanning1790899200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "tournament_zone_venue_plans" ("id" SERIAL NOT NULL, "tournamentCategoryId" integer NOT NULL, "zoneIndex" integer NOT NULL, "venueId" integer NOT NULL, CONSTRAINT "UQ_zone_venue_plan_position" UNIQUE ("tournamentCategoryId", "zoneIndex"), CONSTRAINT "PK_zone_venue_plan" PRIMARY KEY ("id"))');
    await queryRunner.query('ALTER TABLE "tournament_zone_venue_plans" ADD CONSTRAINT "FK_zone_venue_plan_category" FOREIGN KEY ("tournamentCategoryId") REFERENCES "tournament_categories"("id") ON DELETE CASCADE');
    await queryRunner.query('ALTER TABLE "tournament_zone_venue_plans" ADD CONSTRAINT "FK_zone_venue_plan_venue" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tournament_zone_venue_plans"');
  }
}
