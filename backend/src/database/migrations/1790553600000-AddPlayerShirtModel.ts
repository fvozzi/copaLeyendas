import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlayerShirtModel1790553600000 implements MigrationInterface {
  name = 'AddPlayerShirtModel1790553600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."shirt_model" AS ENUM('Guastavino Color 1', 'Guastavino Color 2', 'Dabber Color 3', 'Dabber Color 4')`);
    await queryRunner.query(`ALTER TABLE "players" ADD "shirtModel" "public"."shirt_model"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "players" DROP COLUMN "shirtModel"`);
    await queryRunner.query(`DROP TYPE "public"."shirt_model"`);
  }
}
