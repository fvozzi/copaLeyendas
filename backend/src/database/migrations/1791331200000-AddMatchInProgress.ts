import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchInProgress1791331200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TYPE \"public\".\"match_status\" ADD VALUE IF NOT EXISTS 'IN_PROGRESS' AFTER 'READY'");
    await queryRunner.query('ALTER TABLE "tournament_matches" ADD "startedById" integer');
    await queryRunner.query('ALTER TABLE "tournament_matches" ADD "startedAt" TIMESTAMP WITH TIME ZONE');
    await queryRunner.query('ALTER TABLE "tournament_matches" ADD CONSTRAINT "FK_tournament_matches_started_by" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE SET NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tournament_matches" DROP CONSTRAINT "FK_tournament_matches_started_by"');
    await queryRunner.query('ALTER TABLE "tournament_matches" DROP COLUMN "startedAt"');
    await queryRunner.query('ALTER TABLE "tournament_matches" DROP COLUMN "startedById"');
    await queryRunner.query("UPDATE \"tournament_matches\" SET \"status\" = 'READY' WHERE \"status\" = 'IN_PROGRESS'");
    await queryRunner.query('ALTER TYPE "public"."match_status" RENAME TO "match_status_old"');
    await queryRunner.query("CREATE TYPE \"public\".\"match_status\" AS ENUM ('DRAFT', 'PENDING', 'READY', 'PLAYED', 'SUSPENDED', 'CANCELLED')");
    await queryRunner.query('ALTER TABLE "tournament_matches" ALTER COLUMN "status" DROP DEFAULT');
    await queryRunner.query('ALTER TABLE "tournament_matches" ALTER COLUMN "status" TYPE "public"."match_status" USING "status"::text::"public"."match_status"');
    await queryRunner.query("ALTER TABLE \"tournament_matches\" ALTER COLUMN \"status\" SET DEFAULT 'DRAFT'");
    await queryRunner.query('DROP TYPE "public"."match_status_old"');
  }
}
