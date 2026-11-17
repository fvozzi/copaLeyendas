import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegistrationPaymentOccurredAt1791676800000 implements MigrationInterface {
  name = 'AddRegistrationPaymentOccurredAt1791676800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "registration_payments" ADD "occurredAt" date');
    await queryRunner.query(`UPDATE "registration_payments" SET "occurredAt" = ("createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`);
    await queryRunner.query('ALTER TABLE "registration_payments" ALTER COLUMN "occurredAt" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "registration_payments" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_DATE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "registration_payments" DROP COLUMN "occurredAt"');
  }
}
