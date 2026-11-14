import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveCourtLeadersToVenues1791417600000 implements MigrationInterface {
  name = 'MoveCourtLeadersToVenues1791417600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "venue_leader_assignments" ("id" SERIAL PRIMARY KEY, "venueId" integer NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE, "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, CONSTRAINT "UQ_venue_leader_assignments_venue_user" UNIQUE ("venueId", "userId"))`);
    await queryRunner.query(`INSERT INTO "venue_leader_assignments" ("venueId", "userId") SELECT DISTINCT court."venueId", assignment."userId" FROM "court_assistant_assignments" assignment INNER JOIN "courts" court ON court."id" = assignment."courtId"`);
    await queryRunner.query(`DROP TABLE "court_assistant_assignments"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "court_assistant_assignments" ("id" SERIAL PRIMARY KEY, "courtId" integer NOT NULL REFERENCES "courts"("id") ON DELETE CASCADE, "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, CONSTRAINT "UQ_court_assistant_assignments_court_user" UNIQUE ("courtId", "userId"))`);
    await queryRunner.query(`INSERT INTO "court_assistant_assignments" ("courtId", "userId") SELECT court."id", assignment."userId" FROM "venue_leader_assignments" assignment INNER JOIN "courts" court ON court."venueId" = assignment."venueId"`);
    await queryRunner.query(`DROP TABLE "venue_leader_assignments"`);
  }
}
