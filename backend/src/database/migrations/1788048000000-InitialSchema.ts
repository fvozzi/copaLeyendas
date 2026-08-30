import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1788048000000 implements MigrationInterface {
  name = 'InitialSchema1788048000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('DIRECTOR', 'EDITOR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."content_section" AS ENUM('leyendas', 'canchas', 'torneos', 'historias')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pair_category" AS ENUM('DAMAS_A', 'DAMAS_B', 'DAMAS_NUCLEO_A', 'DAMAS_NUCLEO_B')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."registration_access_grant_status" AS ENUM('ACTIVE', 'USED', 'REVOKED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."heard_about_source" AS ENUM('INSTAGRAM', 'FRIEND', 'CLUB', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shirt_size" AS ENUM('S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', 'XXXXXL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."registration_status" AS ENUM('RECEIVED', 'UNDER_REVIEW', 'CONFIRMED', 'WAITLIST', 'REJECTED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "name" character varying NOT NULL,
        "role" "public"."user_role" NOT NULL DEFAULT 'DIRECTOR',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "content_posts" (
        "id" SERIAL NOT NULL,
        "section" "public"."content_section" NOT NULL,
        "title" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "excerpt" character varying(320) NOT NULL,
        "body" text NOT NULL,
        "coverImageUrl" character varying,
        "published" boolean NOT NULL DEFAULT false,
        "featured" boolean NOT NULL DEFAULT false,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_content_posts_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_content_posts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "registration_access_grants" (
        "id" SERIAL NOT NULL,
        "token" character varying NOT NULL,
        "category" "public"."pair_category" NOT NULL,
        "localityName" character varying NOT NULL,
        "provinceName" character varying NOT NULL,
        "clubName" character varying NOT NULL,
        "contactName" character varying,
        "contactEmail" character varying,
        "contactPhone" character varying,
        "notes" text,
        "feeWaived" boolean NOT NULL DEFAULT false,
        "status" "public"."registration_access_grant_status" NOT NULL DEFAULT 'ACTIVE',
        "consumedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_registration_access_grants_token" UNIQUE ("token"),
        CONSTRAINT "PK_registration_access_grants_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "pair_registrations" (
        "id" SERIAL NOT NULL,
        "accessGrantId" integer NOT NULL,
        "category" "public"."pair_category" NOT NULL,
        "localityName" character varying NOT NULL,
        "provinceName" character varying NOT NULL,
        "clubName" character varying NOT NULL,
        "heardAboutSource" "public"."heard_about_source" NOT NULL,
        "heardAboutOtherText" character varying,
        "tournamentAvailabilityConfirmed" boolean NOT NULL DEFAULT false,
        "representingText" character varying NOT NULL,
        "contactEmail" character varying,
        "feeWaived" boolean NOT NULL DEFAULT false,
        "playerOneName" character varying NOT NULL,
        "playerOneDni" character varying NOT NULL,
        "playerOneBirthDate" date NOT NULL,
        "playerOnePhone" character varying NOT NULL,
        "playerOneInstagram" character varying,
        "playerOneShirtSize" "public"."shirt_size" NOT NULL,
        "playerTwoName" character varying NOT NULL,
        "playerTwoDni" character varying NOT NULL,
        "playerTwoBirthDate" date NOT NULL,
        "playerTwoPhone" character varying NOT NULL,
        "playerTwoInstagram" character varying,
        "playerTwoShirtSize" "public"."shirt_size" NOT NULL,
        "playerThreeName" character varying,
        "playerThreeDni" character varying,
        "playerThreeBirthDate" date,
        "playerThreePhone" character varying,
        "playerThreeInstagram" character varying,
        "playerThreeShirtSize" "public"."shirt_size",
        "substituteName" character varying,
        "substituteDni" character varying,
        "substituteBirthDate" date,
        "substitutePhone" character varying,
        "substituteInstagram" character varying,
        "substituteShirtSize" "public"."shirt_size",
        "paymentProofStoredName" character varying,
        "paymentProofOriginalName" character varying,
        "paymentProofMimeType" character varying,
        "paymentProofSizeBytes" integer,
        "status" "public"."registration_status" NOT NULL DEFAULT 'RECEIVED',
        "adminNotes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pair_registrations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "pair_registrations"
      ADD CONSTRAINT "FK_pair_registrations_accessGrantId"
      FOREIGN KEY ("accessGrantId")
      REFERENCES "registration_access_grants"("id")
      ON DELETE RESTRICT
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pair_registrations" DROP CONSTRAINT "FK_pair_registrations_accessGrantId"`,
    );
    await queryRunner.query(`DROP TABLE "pair_registrations"`);
    await queryRunner.query(`DROP TABLE "registration_access_grants"`);
    await queryRunner.query(`DROP TABLE "content_posts"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."registration_status"`);
    await queryRunner.query(`DROP TYPE "public"."shirt_size"`);
    await queryRunner.query(`DROP TYPE "public"."heard_about_source"`);
    await queryRunner.query(`DROP TYPE "public"."registration_access_grant_status"`);
    await queryRunner.query(`DROP TYPE "public"."pair_category"`);
    await queryRunner.query(`DROP TYPE "public"."content_section"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
