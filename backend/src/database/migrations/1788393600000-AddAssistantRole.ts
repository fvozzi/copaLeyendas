import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssistantRole1788393600000 implements MigrationInterface {
  name = 'AddAssistantRole1788393600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'ASSISTANT'`);
    await queryRunner.query(`UPDATE "users" SET "role" = 'ASSISTANT' WHERE "role" = 'EDITOR'`);
  }

  public async down(): Promise<void> {
    // PostgreSQL enum values cannot be removed safely in a reversible migration.
  }
}
