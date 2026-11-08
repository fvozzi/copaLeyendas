import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTournamentAttendance1790726400000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('CREATE TABLE "tournament_registration_attendance" ("id" SERIAL NOT NULL, "tournamentId" integer NOT NULL, "registrationId" integer NOT NULL, "present" boolean NOT NULL DEFAULT true, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_tournament_registration_attendance" UNIQUE ("tournamentId", "registrationId"), CONSTRAINT "PK_tournament_registration_attendance" PRIMARY KEY ("id"))');
    await runner.query('ALTER TABLE "tournament_registration_attendance" ADD CONSTRAINT "FK_attendance_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE');
    await runner.query('ALTER TABLE "tournament_registration_attendance" ADD CONSTRAINT "FK_attendance_registration" FOREIGN KEY ("registrationId") REFERENCES "pair_registrations"("id") ON DELETE CASCADE');
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "tournament_registration_attendance"');
  }
}
