import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTournamentMethodology1791244800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("CREATE TYPE \"public\".\"zone_methodology\" AS ENUM ('PROVINCE', 'ROUND_ROBIN')");
    await queryRunner.query("ALTER TABLE \"tournament_categories\" ADD \"methodology\" \"public\".\"zone_methodology\" NOT NULL DEFAULT 'PROVINCE'");
    await queryRunner.query('ALTER TABLE "tournament_categories" ADD "qualifiersPerZone" integer NOT NULL DEFAULT 2');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tournament_categories" DROP COLUMN "qualifiersPerZone"');
    await queryRunner.query('ALTER TABLE "tournament_categories" DROP COLUMN "methodology"');
    await queryRunner.query('DROP TYPE "public"."zone_methodology"');
  }
}
