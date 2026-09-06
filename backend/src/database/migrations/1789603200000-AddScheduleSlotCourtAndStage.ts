import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleSlotCourtAndStage1789603200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" ADD "stage" varchar NOT NULL DEFAULT 'ZONE'`);
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" ADD "courtId" integer`);
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" ADD CONSTRAINT "FK_schedule_slots_court" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE SET NULL`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" DROP CONSTRAINT "FK_schedule_slots_court"`);
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" DROP COLUMN "courtId"`);
    await queryRunner.query(`ALTER TABLE "tournament_schedule_slots" DROP COLUMN "stage"`);
  }
}
