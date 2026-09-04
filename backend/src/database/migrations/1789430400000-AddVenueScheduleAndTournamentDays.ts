import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVenueScheduleAndTournamentDays1789430400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "venues" ADD "startsAt" time NOT NULL DEFAULT '10:00'`);
    await queryRunner.query(`ALTER TABLE "venues" ADD "matchDurationMinutes" integer NOT NULL DEFAULT 40`);
    await queryRunner.query(`ALTER TABLE "venues" ADD "matchesPerDay" integer NOT NULL DEFAULT 16`);
    await queryRunner.query(`ALTER TABLE "tournaments" ADD "playingDays" date[] NOT NULL DEFAULT ARRAY[]::date[]`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "playingDays"`);
    await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN "matchesPerDay"`);
    await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN "matchDurationMinutes"`);
    await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN "startsAt"`);
  }
}
