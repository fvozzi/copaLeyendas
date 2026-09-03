import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchSchedulingGrid1788998400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('CREATE TABLE "tournament_schedule_slots" ("id" SERIAL PRIMARY KEY, "tournamentId" integer NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE, "tournamentCategoryId" integer NOT NULL REFERENCES "tournament_categories"("id") ON DELETE CASCADE, "zoneName" varchar NOT NULL, "matchOrder" integer NOT NULL, "sequence" integer NOT NULL, "scheduledAt" TIMESTAMP WITH TIME ZONE)');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "tournament_schedule_slots"');
  }
}
