import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeferredRegistrationPayment1788739200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "registration_access_grants" ADD "paymentDeferredUntilConfirmed" boolean NOT NULL DEFAULT false`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "registration_access_grants" DROP COLUMN "paymentDeferredUntilConfirmed"`);
  }
}
