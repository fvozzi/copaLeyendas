import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnonymousWebAnalytics1791763200000 implements MigrationInterface {
  name = 'AddAnonymousWebAnalytics1791763200000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "analytics_page_views" (
      "id" SERIAL NOT NULL,
      "path" character varying(300) NOT NULL,
      "section" character varying(80) NOT NULL,
      "visitorHash" character(64) NOT NULL,
      "device" character varying(10) NOT NULL,
      "referrerHost" character varying(200),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_analytics_page_views" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_analytics_page_views_device" CHECK ("device" IN ('MOBILE', 'TABLET', 'DESKTOP'))
    )`);
    await runner.query('CREATE INDEX "IDX_analytics_page_views_createdAt" ON "analytics_page_views" ("createdAt")');
    await runner.query('CREATE INDEX "IDX_analytics_page_views_path_createdAt" ON "analytics_page_views" ("path", "createdAt")');
    await runner.query('CREATE INDEX "IDX_analytics_page_views_section_createdAt" ON "analytics_page_views" ("section", "createdAt")');
    await runner.query('CREATE INDEX "IDX_analytics_page_views_visitor_createdAt" ON "analytics_page_views" ("visitorHash", "createdAt")');
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "analytics_page_views"');
  }
}
