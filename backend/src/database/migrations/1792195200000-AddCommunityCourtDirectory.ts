import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommunityCourtDirectory1792195200000 implements MigrationInterface {
  name = 'AddCommunityCourtDirectory1792195200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "community_courts" (
      "id" SERIAL NOT NULL,
      "name" character varying(140) NOT NULL,
      "country" character varying(80) NOT NULL,
      "province" character varying(120) NOT NULL,
      "locality" character varying(120) NOT NULL,
      "address" character varying(220),
      "latitude" double precision NOT NULL,
      "longitude" double precision NOT NULL,
      "lengthMeters" real,
      "widthMeters" real,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_community_courts" PRIMARY KEY ("id")
    )`);
    await queryRunner.query('CREATE INDEX "IDX_community_courts_location" ON "community_courts" ("country", "province", "locality")');
    await queryRunner.query(`CREATE TABLE "community_court_player_groups" (
      "id" SERIAL NOT NULL,
      "courtId" integer NOT NULL,
      "gender" character varying(12) NOT NULL,
      "minAge" smallint,
      "maxAge" smallint,
      "playerCount" integer NOT NULL,
      CONSTRAINT "CHK_community_group_gender" CHECK ("gender" IN ('FEMALE', 'MALE', 'MIXED', 'OTHER')),
      CONSTRAINT "CHK_community_group_ages" CHECK (("minAge" IS NULL OR "minAge" BETWEEN 0 AND 120) AND ("maxAge" IS NULL OR "maxAge" BETWEEN 0 AND 120) AND ("minAge" IS NULL OR "maxAge" IS NULL OR "minAge" <= "maxAge")),
      CONSTRAINT "CHK_community_group_count" CHECK ("playerCount" > 0),
      CONSTRAINT "FK_community_group_court" FOREIGN KEY ("courtId") REFERENCES "community_courts"("id") ON DELETE CASCADE,
      CONSTRAINT "PK_community_court_player_groups" PRIMARY KEY ("id")
    )`);
    await queryRunner.query('CREATE INDEX "IDX_community_groups_court" ON "community_court_player_groups" ("courtId")');
    await queryRunner.query('CREATE INDEX "IDX_community_groups_filter" ON "community_court_player_groups" ("gender", "minAge", "maxAge")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "community_court_player_groups"');
    await queryRunner.query('DROP TABLE "community_courts"');
  }
}
