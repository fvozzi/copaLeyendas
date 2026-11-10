import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarkDirectorVenueAssignments1790985600000 implements MigrationInterface {
  name = 'MarkDirectorVenueAssignments1790985600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Existing rows may have been generated automatically. They must not be
    // treated as a decision made by Direction after auto-assignment is removed.
    await queryRunner.query('ALTER TABLE "tournament_zone_venue_plans" ADD "directorAssigned" boolean NOT NULL DEFAULT false');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tournament_zone_venue_plans" DROP COLUMN "directorAssigned"');
  }
}
