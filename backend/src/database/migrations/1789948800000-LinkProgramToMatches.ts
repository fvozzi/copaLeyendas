import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkProgramToMatches1789948800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_matches" ALTER COLUMN "zoneId" DROP NOT NULL`);
    for (const side of ['home', 'away']) {
      await queryRunner.query(`ALTER TABLE "tournament_matches" ADD "${side}QualifierZoneId" integer REFERENCES zones(id) ON DELETE SET NULL, ADD "${side}QualifierRank" integer`);
    }
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" ADD "matchId" integer`);
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" ADD CONSTRAINT "UQ_schedule_match" UNIQUE ("matchId")`);
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" ADD CONSTRAINT "FK_schedule_match" FOREIGN KEY ("matchId") REFERENCES "tournament_matches"("id") ON DELETE CASCADE`);
    // Link existing games without recreating IDs or touching scores and participants.
    await queryRunner.query(`WITH candidates AS (
      SELECT s.id AS slot_id, m.id AS match_id, m."scheduledAt", ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY s.id) AS position
      FROM tournament_schedule_slots s
      JOIN zones z ON z."tournamentCategoryId" = s."tournamentCategoryId" AND z.name = s."zoneName"
      JOIN tournament_matches m ON m."zoneId" = z.id AND m."matchOrder" = s."matchOrder"
      WHERE s.stage = 'ZONE'
    ) UPDATE tournament_schedule_slots s SET "matchId" = c.match_id, "scheduledAt" = COALESCE(c."scheduledAt", s."scheduledAt") FROM candidates c WHERE s.id = c.slot_id AND c.position = 1`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(`SELECT COUNT(*)::integer AS count FROM tournament_matches WHERE "zoneId" IS NULL`);
    if (count) throw new Error('No se puede revertir la unificación mientras existan partidos de eliminatorias.');
    await queryRunner.query(`UPDATE tournament_matches m SET "scheduledAt" = s."scheduledAt" FROM tournament_schedule_slots s WHERE s."matchId" = m.id`);
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" DROP COLUMN "matchId"`);
    for (const side of ['home', 'away']) await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN "${side}QualifierZoneId", DROP COLUMN "${side}QualifierRank"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ALTER COLUMN "zoneId" SET NOT NULL`);
  }
}
