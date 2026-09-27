import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeRegistrationLocalities1790380800000 implements MigrationInterface {
  name = 'NormalizeRegistrationLocalities1790380800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "registration_access_grants" grant_row
      SET "localityId" = (
        SELECT locality."id" FROM "localities" locality
        WHERE LOWER(TRIM(locality."name")) = LOWER(TRIM(grant_row."localityName"))
          AND LOWER(TRIM(locality."provinceName")) = LOWER(TRIM(grant_row."provinceName"))
          AND locality."categoryId" = grant_row."categoryId"
        ORDER BY locality."id"
        LIMIT 1
      )
      WHERE grant_row."localityId" IS NULL
        AND EXISTS (
          SELECT 1 FROM "localities" locality
          WHERE LOWER(TRIM(locality."name")) = LOWER(TRIM(grant_row."localityName"))
            AND LOWER(TRIM(locality."provinceName")) = LOWER(TRIM(grant_row."provinceName"))
            AND locality."categoryId" = grant_row."categoryId"
        )
    `);
    // A legacy grant may have missed its ID before its locality was renamed. If its
    // province/category now identifies one team unambiguously, preserve that rename.
    await queryRunner.query(`
      UPDATE "registration_access_grants" grant_row
      SET "localityId" = (
        SELECT MIN(locality."id") FROM "localities" locality
        WHERE LOWER(TRIM(locality."provinceName")) = LOWER(TRIM(grant_row."provinceName"))
          AND locality."categoryId" = grant_row."categoryId"
      )
      WHERE grant_row."localityId" IS NULL
        AND 1 = (
          SELECT COUNT(*) FROM "localities" locality
          WHERE LOWER(TRIM(locality."provinceName")) = LOWER(TRIM(grant_row."provinceName"))
            AND locality."categoryId" = grant_row."categoryId"
        )
    `);
    await queryRunner.query(`
      INSERT INTO "localities" ("name", "provinceName", "active", "categoryId")
      SELECT DISTINCT grant_row."localityName", grant_row."provinceName", true, grant_row."categoryId"
      FROM "registration_access_grants" grant_row
      WHERE grant_row."localityId" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "localities" locality
          WHERE LOWER(TRIM(locality."name")) = LOWER(TRIM(grant_row."localityName"))
            AND LOWER(TRIM(locality."provinceName")) = LOWER(TRIM(grant_row."provinceName"))
            AND locality."categoryId" = grant_row."categoryId"
        )
    `);
    await queryRunner.query(`
      UPDATE "registration_access_grants" grant_row
      SET "localityId" = (
        SELECT locality."id" FROM "localities" locality
        WHERE LOWER(TRIM(locality."name")) = LOWER(TRIM(grant_row."localityName"))
          AND LOWER(TRIM(locality."provinceName")) = LOWER(TRIM(grant_row."provinceName"))
          AND locality."categoryId" = grant_row."categoryId"
        ORDER BY locality."id"
        LIMIT 1
      )
      WHERE grant_row."localityId" IS NULL
    `);
    await queryRunner.query('ALTER TABLE "registration_access_grants" DROP CONSTRAINT "FK_grants_locality"');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ALTER COLUMN "localityId" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ADD CONSTRAINT "FK_grants_locality" FOREIGN KEY ("localityId") REFERENCES "localities"("id") ON DELETE RESTRICT');

    await queryRunner.query('ALTER TABLE "pair_registrations" ADD "localityId" integer');
    await queryRunner.query(`
      UPDATE "pair_registrations" registration
      SET "localityId" = grant_row."localityId"
      FROM "registration_access_grants" grant_row
      WHERE grant_row."id" = registration."accessGrantId"
    `);
    await queryRunner.query('ALTER TABLE "pair_registrations" ALTER COLUMN "localityId" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "pair_registrations" ADD CONSTRAINT "FK_pair_registrations_locality" FOREIGN KEY ("localityId") REFERENCES "localities"("id") ON DELETE RESTRICT');

    // Existing player rows may point to an old locality created from a copied registration name.
    // The latest registration for each DNI is the authoritative team assignment.
    await queryRunner.query(`
      UPDATE "players" player
      SET "localityId" = latest."localityId"
      FROM (
        SELECT DISTINCT ON (player_identity."dni") player_identity."dni", registration."localityId"
        FROM "pair_registrations" registration
        CROSS JOIN LATERAL (VALUES
          (registration."playerOneDni"),
          (registration."playerTwoDni"),
          (registration."playerThreeDni")
        ) player_identity("dni")
        WHERE player_identity."dni" IS NOT NULL AND TRIM(player_identity."dni") <> ''
        ORDER BY player_identity."dni", registration."updatedAt" DESC, registration."id" DESC
      ) latest
      WHERE TRIM(player."dni") = TRIM(latest."dni")
    `);

    await queryRunner.query('ALTER TABLE "pair_registrations" DROP COLUMN "clubName"');
    await queryRunner.query('ALTER TABLE "pair_registrations" DROP COLUMN "provinceName"');
    await queryRunner.query('ALTER TABLE "pair_registrations" DROP COLUMN "localityName"');
    await queryRunner.query('ALTER TABLE "registration_access_grants" DROP COLUMN "clubName"');
    await queryRunner.query('ALTER TABLE "registration_access_grants" DROP COLUMN "provinceName"');
    await queryRunner.query('ALTER TABLE "registration_access_grants" DROP COLUMN "localityName"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "registration_access_grants" ADD "localityName" character varying');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ADD "provinceName" character varying');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ADD "clubName" character varying');
    await queryRunner.query(`UPDATE "registration_access_grants" grant_row SET "localityName" = locality."name", "provinceName" = locality."provinceName", "clubName" = locality."name" FROM "localities" locality WHERE locality."id" = grant_row."localityId"`);
    await queryRunner.query('ALTER TABLE "registration_access_grants" ALTER COLUMN "localityName" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ALTER COLUMN "provinceName" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ALTER COLUMN "clubName" SET NOT NULL');

    await queryRunner.query('ALTER TABLE "pair_registrations" ADD "localityName" character varying');
    await queryRunner.query('ALTER TABLE "pair_registrations" ADD "provinceName" character varying');
    await queryRunner.query('ALTER TABLE "pair_registrations" ADD "clubName" character varying');
    await queryRunner.query(`UPDATE "pair_registrations" registration SET "localityName" = locality."name", "provinceName" = locality."provinceName", "clubName" = locality."name" FROM "localities" locality WHERE locality."id" = registration."localityId"`);
    await queryRunner.query('ALTER TABLE "pair_registrations" ALTER COLUMN "localityName" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "pair_registrations" ALTER COLUMN "provinceName" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "pair_registrations" ALTER COLUMN "clubName" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "pair_registrations" DROP CONSTRAINT "FK_pair_registrations_locality"');
    await queryRunner.query('ALTER TABLE "pair_registrations" DROP COLUMN "localityId"');

    await queryRunner.query('ALTER TABLE "registration_access_grants" DROP CONSTRAINT "FK_grants_locality"');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ALTER COLUMN "localityId" DROP NOT NULL');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ADD CONSTRAINT "FK_grants_locality" FOREIGN KEY ("localityId") REFERENCES "localities"("id") ON DELETE SET NULL');
  }
}
