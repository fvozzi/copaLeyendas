import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddDatabaseBackups1789862400000 implements MigrationInterface {
  name = 'AddDatabaseBackups1789862400000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "backup_settings" (
      "id" integer NOT NULL DEFAULT 1 PRIMARY KEY CHECK ("id" = 1),
      "enabled" boolean NOT NULL DEFAULT true,
      "retentionCount" integer NOT NULL DEFAULT 30 CHECK ("retentionCount" BETWEEN 1 AND 365),
      "scheduleHour" integer NOT NULL DEFAULT 3 CHECK ("scheduleHour" BETWEEN 0 AND 23),
      "scheduleMinute" integer NOT NULL DEFAULT 0 CHECK ("scheduleMinute" BETWEEN 0 AND 59)
    )`);
    await queryRunner.query(`INSERT INTO "backup_settings" ("id") VALUES (1)`);
    await queryRunner.query(`CREATE TABLE "database_backups" (
      "id" SERIAL PRIMARY KEY, "triggerType" varchar NOT NULL, "status" varchar NOT NULL,
      "createdByName" varchar, "fileName" varchar, "fileSizeBytes" bigint, "errorMessage" text,
      "startedAt" timestamptz NOT NULL, "finishedAt" timestamptz
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "database_backups"');
    await queryRunner.query('DROP TABLE "backup_settings"');
  }
}
