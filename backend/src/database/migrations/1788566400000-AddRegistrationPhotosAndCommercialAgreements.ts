import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegistrationPhotosAndCommercialAgreements1788566400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pair_registrations" ADD "hasCommercialAgreement" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "pair_registrations" ADD "commercialAgreementDetails" text`);
    for (const player of ['playerOne', 'playerTwo', 'playerThree']) {
      await queryRunner.query(`ALTER TABLE "pair_registrations" ADD "${player}PhotoStoredName" character varying`);
      await queryRunner.query(`ALTER TABLE "pair_registrations" ADD "${player}PhotoOriginalName" character varying`);
      await queryRunner.query(`ALTER TABLE "pair_registrations" ADD "${player}PhotoMimeType" character varying`);
      await queryRunner.query(`ALTER TABLE "pair_registrations" ADD "${player}PhotoSizeBytes" integer`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const player of ['playerThree', 'playerTwo', 'playerOne']) {
      await queryRunner.query(`ALTER TABLE "pair_registrations" DROP COLUMN "${player}PhotoSizeBytes"`);
      await queryRunner.query(`ALTER TABLE "pair_registrations" DROP COLUMN "${player}PhotoMimeType"`);
      await queryRunner.query(`ALTER TABLE "pair_registrations" DROP COLUMN "${player}PhotoOriginalName"`);
      await queryRunner.query(`ALTER TABLE "pair_registrations" DROP COLUMN "${player}PhotoStoredName"`);
    }
    await queryRunner.query(`ALTER TABLE "pair_registrations" DROP COLUMN "commercialAgreementDetails"`);
    await queryRunner.query(`ALTER TABLE "pair_registrations" DROP COLUMN "hasCommercialAgreement"`);
  }
}
