import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocalitiesAndPlayers1788134400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "localities" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "provinceName" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_localities_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "players" (
        "id" SERIAL NOT NULL,
        "fullName" character varying NOT NULL,
        "dni" character varying NOT NULL,
        "birthDate" date,
        "phone" character varying,
        "instagram" character varying,
        "shirtSize" "public"."shirt_size",
        "localityId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_players_dni" UNIQUE ("dni"),
        CONSTRAINT "PK_players_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "players" ADD CONSTRAINT "FK_players_locality"
      FOREIGN KEY ("localityId") REFERENCES "localities"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "players" DROP CONSTRAINT "FK_players_locality"`);
    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(`DROP TABLE "localities"`);
  }
}
