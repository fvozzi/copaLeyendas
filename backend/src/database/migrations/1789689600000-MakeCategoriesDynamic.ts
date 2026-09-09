import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeCategoriesDynamic1789689600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "registration_access_grants" ADD "categoryId" integer');
    await queryRunner.query('ALTER TABLE "pair_registrations" ADD "categoryId" integer');
    await queryRunner.query('UPDATE "registration_access_grants" AS g SET "categoryId" = c.id FROM "categories" AS c WHERE g.category::text = c.code::text');
    await queryRunner.query('UPDATE "pair_registrations" AS r SET "categoryId" = c.id FROM "categories" AS c WHERE r.category::text = c.code::text');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ALTER COLUMN "categoryId" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "pair_registrations" ALTER COLUMN "categoryId" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ADD CONSTRAINT "FK_grants_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT');
    await queryRunner.query('ALTER TABLE "pair_registrations" ADD CONSTRAINT "FK_registrations_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT');
    await queryRunner.query('ALTER TABLE "registration_access_grants" DROP COLUMN "category"');
    await queryRunner.query('ALTER TABLE "pair_registrations" DROP COLUMN "category"');
    await queryRunner.query('ALTER TABLE "categories" DROP COLUMN "code"');
    await queryRunner.query('ALTER TABLE "categories" ADD CONSTRAINT "UQ_categories_name" UNIQUE ("name")');
    await queryRunner.query('DROP TYPE "public"."pair_category"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "categories" DROP CONSTRAINT "UQ_categories_name"');
    await queryRunner.query('ALTER TABLE "categories" ADD "code" varchar');
    await queryRunner.query(`UPDATE "categories" SET "code" = CASE "name" WHEN 'Damas A' THEN 'DAMAS_A' WHEN 'Damas B' THEN 'DAMAS_B' WHEN 'Damas Nucleo A' THEN 'DAMAS_NUCLEO_A' WHEN 'Damas Nucleo B' THEN 'DAMAS_NUCLEO_B' ELSE 'CATEGORY_' || id::text END`);
    await queryRunner.query(`DO $$ DECLARE enum_values text; BEGIN SELECT string_agg(quote_literal("code"), ',') INTO enum_values FROM "categories"; EXECUTE 'CREATE TYPE "pair_category" AS ENUM (' || enum_values || ')'; END $$`);
    await queryRunner.query('ALTER TABLE "categories" ALTER COLUMN "code" TYPE "pair_category" USING "code"::"pair_category"');
    await queryRunner.query('ALTER TABLE "categories" ALTER COLUMN "code" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "categories" ADD CONSTRAINT "UQ_categories_code" UNIQUE ("code")');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ADD "category" "pair_category"');
    await queryRunner.query('ALTER TABLE "pair_registrations" ADD "category" "pair_category"');
    await queryRunner.query('UPDATE "registration_access_grants" AS g SET "category" = c.code FROM "categories" AS c WHERE g."categoryId" = c.id');
    await queryRunner.query('UPDATE "pair_registrations" AS r SET "category" = c.code FROM "categories" AS c WHERE r."categoryId" = c.id');
    await queryRunner.query('ALTER TABLE "registration_access_grants" ALTER COLUMN "category" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "pair_registrations" ALTER COLUMN "category" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "registration_access_grants" DROP CONSTRAINT "FK_grants_category"');
    await queryRunner.query('ALTER TABLE "pair_registrations" DROP CONSTRAINT "FK_registrations_category"');
    await queryRunner.query('ALTER TABLE "registration_access_grants" DROP COLUMN "categoryId"');
    await queryRunner.query('ALTER TABLE "pair_registrations" DROP COLUMN "categoryId"');
  }
}
