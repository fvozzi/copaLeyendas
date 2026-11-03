import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourtLeaderAndMatchResultPhotos1790640000000 implements MigrationInterface {
  name = 'AddCourtLeaderAndMatchResultPhotos1790640000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'COURT_LEADER'`);
    await queryRunner.query(`UPDATE "users" SET "role" = 'COURT_LEADER' WHERE "role" = 'ASSISTANT'`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "resultPhotoStoredName" character varying`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "resultPhotoOriginalName" character varying`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "resultPhotoMimeType" character varying`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "resultPhotoSize" integer`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "resultSubmittedById" integer`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD COLUMN IF NOT EXISTS "resultSubmittedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" ADD CONSTRAINT "FK_match_result_submitted_by" FOREIGN KEY ("resultSubmittedById") REFERENCES "users"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP CONSTRAINT IF EXISTS "FK_match_result_submitted_by"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN IF EXISTS "resultSubmittedAt"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN IF EXISTS "resultSubmittedById"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN IF EXISTS "resultPhotoSize"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN IF EXISTS "resultPhotoMimeType"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN IF EXISTS "resultPhotoOriginalName"`);
    await queryRunner.query(`ALTER TABLE "tournament_matches" DROP COLUMN IF EXISTS "resultPhotoStoredName"`);
  }
}
