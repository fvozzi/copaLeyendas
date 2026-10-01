import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityLogs1790467200000 implements MigrationInterface {
  name = 'AddActivityLogs1790467200000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "activity_logs" (
      "id" SERIAL PRIMARY KEY,
      "requestId" uuid NOT NULL UNIQUE,
      "level" varchar(10) NOT NULL,
      "source" varchar(10) NOT NULL,
      "method" varchar(10) NOT NULL,
      "path" varchar(300) NOT NULL,
      "message" varchar(300) NOT NULL,
      "statusCode" integer NOT NULL,
      "durationMs" integer NOT NULL,
      "actorUserId" integer,
      "actorName" varchar(160),
      "detail" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "activity_logs_level" CHECK ("level" IN ('INFO', 'WARNING', 'ERROR')),
      CONSTRAINT "activity_logs_source" CHECK ("source" IN ('PUBLIC', 'ADMIN'))
    )`);
    await runner.query('CREATE INDEX "IDX_activity_logs_createdAt" ON "activity_logs" ("createdAt")');
    await runner.query('CREATE INDEX "IDX_activity_logs_level_createdAt" ON "activity_logs" ("level", "createdAt")');
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "activity_logs"');
  }
}
