import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlayerCommercialAgreements1788652800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const player of ['playerOne', 'playerTwo', 'playerThree']) {
      await queryRunner.query(`ALTER TABLE "pair_registrations" ADD "${player}HasCommercialAgreement" boolean NOT NULL DEFAULT false`);
      await queryRunner.query(`ALTER TABLE "pair_registrations" ADD "${player}CommercialAgreementDetails" text`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const player of ['playerThree', 'playerTwo', 'playerOne']) {
      await queryRunner.query(`ALTER TABLE "pair_registrations" DROP COLUMN "${player}CommercialAgreementDetails"`);
      await queryRunner.query(`ALTER TABLE "pair_registrations" DROP COLUMN "${player}HasCommercialAgreement"`);
    }
  }
}
