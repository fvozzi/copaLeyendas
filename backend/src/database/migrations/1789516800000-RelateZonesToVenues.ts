import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelateZonesToVenues1789516800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "zones" ADD "venueId" integer');
    await queryRunner.query('UPDATE "zones" zone SET "venueId" = court."venueId" FROM "courts" court WHERE court."id" = zone."courtId"');
    await queryRunner.query('ALTER TABLE "zones" ALTER COLUMN "venueId" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "zones" ADD CONSTRAINT "FK_zones_venue" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT');
    await queryRunner.query(`DO $$ DECLARE key_name text; BEGIN SELECT conname INTO key_name FROM pg_constraint WHERE conrelid = 'zones'::regclass AND contype = 'f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'zones'::regclass AND attname = 'courtId')]; IF key_name IS NOT NULL THEN EXECUTE format('ALTER TABLE "zones" DROP CONSTRAINT %I', key_name); END IF; END $$`);
    await queryRunner.query('ALTER TABLE "zones" DROP COLUMN "courtId"');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "zones" ADD "courtId" integer');
    await queryRunner.query('UPDATE "zones" zone SET "courtId" = (SELECT court."id" FROM "courts" court WHERE court."venueId" = zone."venueId" ORDER BY court."id" LIMIT 1)');
    await queryRunner.query('ALTER TABLE "zones" ALTER COLUMN "courtId" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "zones" ADD CONSTRAINT "FK_zones_court" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE RESTRICT');
    await queryRunner.query('ALTER TABLE "zones" DROP CONSTRAINT "FK_zones_venue"');
    await queryRunner.query('ALTER TABLE "zones" DROP COLUMN "venueId"');
  }
}
