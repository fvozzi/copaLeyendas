import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityCourtPhotosAndSchool1792454400000 implements MigrationInterface {
  name = 'AddCommunityCourtPhotosAndSchool1792454400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "community_courts" ADD COLUMN IF NOT EXISTS "hasSchool" boolean NOT NULL DEFAULT false');
    await queryRunner.query(`CREATE TABLE "community_court_photos" (
      "id" SERIAL NOT NULL,
      "courtId" integer NOT NULL,
      "storedName" character varying(80) NOT NULL,
      "originalName" character varying(220) NOT NULL,
      "mimeType" character varying(80) NOT NULL,
      "sortOrder" smallint NOT NULL,
      CONSTRAINT "FK_community_court_photo_court" FOREIGN KEY ("courtId") REFERENCES "community_courts"("id") ON DELETE CASCADE,
      CONSTRAINT "PK_community_court_photos" PRIMARY KEY ("id")
    )`);
    await queryRunner.query('CREATE INDEX "IDX_community_court_photos_court" ON "community_court_photos" ("courtId", "sortOrder")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "community_court_photos"');
    await queryRunner.query('ALTER TABLE "community_courts" DROP COLUMN "hasSchool"');
  }
}
