import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoriesCourtsAndLocalityCategory1788220800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "categories" ("id" SERIAL NOT NULL, "code" "public"."pair_category" NOT NULL, "name" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_categories_code" UNIQUE ("code"), CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"))`);
    await queryRunner.query(`INSERT INTO "categories" ("code", "name", "sortOrder") VALUES ('DAMAS_A', 'Damas A', 10), ('DAMAS_B', 'Damas B', 20), ('DAMAS_NUCLEO_A', 'Damas Nucleo A', 30), ('DAMAS_NUCLEO_B', 'Damas Nucleo B', 40)`);
    await queryRunner.query(`CREATE TABLE "courts" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "address" character varying, "city" character varying, "provinceName" character varying, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_courts_id" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "localities" ADD "categoryId" integer`);
    await queryRunner.query(`ALTER TABLE "localities" ADD CONSTRAINT "FK_localities_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "registration_access_grants" ADD "localityId" integer`);
    await queryRunner.query(`ALTER TABLE "registration_access_grants" ADD CONSTRAINT "FK_grants_locality" FOREIGN KEY ("localityId") REFERENCES "localities"("id") ON DELETE SET NULL`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query(`ALTER TABLE "registration_access_grants" DROP CONSTRAINT "FK_grants_locality"`); await queryRunner.query(`ALTER TABLE "registration_access_grants" DROP COLUMN "localityId"`); await queryRunner.query(`ALTER TABLE "localities" DROP CONSTRAINT "FK_localities_category"`); await queryRunner.query(`ALTER TABLE "localities" DROP COLUMN "categoryId"`); await queryRunner.query(`DROP TABLE "courts"`); await queryRunner.query(`DROP TABLE "categories"`); }
}
