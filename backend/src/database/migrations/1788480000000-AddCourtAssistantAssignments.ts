import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourtAssistantAssignments1788480000000 implements MigrationInterface {
  name = 'AddCourtAssistantAssignments1788480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "court_assistant_assignments" ("id" SERIAL PRIMARY KEY, "courtId" integer NOT NULL REFERENCES "courts"("id") ON DELETE CASCADE, "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, CONSTRAINT "UQ_court_assistant_assignments_court_user" UNIQUE ("courtId", "userId"))`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD COLUMN "scheduledAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN "scheduledAt"`);
    await queryRunner.query(`DROP TABLE "court_assistant_assignments"`);
  }
}
