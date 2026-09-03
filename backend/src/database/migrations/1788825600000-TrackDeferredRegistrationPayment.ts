import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackDeferredRegistrationPayment1788825600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pair_registrations" ADD "paymentDeferredUntilConfirmed" boolean NOT NULL DEFAULT false`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pair_registrations" DROP COLUMN "paymentDeferredUntilConfirmed"`);
  }
}
