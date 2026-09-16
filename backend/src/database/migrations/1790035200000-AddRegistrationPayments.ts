import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegistrationPayments1790035200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "registration_payments" (
      "id" SERIAL PRIMARY KEY, "registrationId" integer NOT NULL REFERENCES "pair_registrations"("id") ON DELETE CASCADE,
      "kind" varchar NOT NULL, "players" integer NOT NULL, "rosterSize" integer NOT NULL,
      "amount" integer NOT NULL, "storedName" varchar NOT NULL, "originalName" varchar NOT NULL,
      "mimeType" varchar NOT NULL, "sizeBytes" integer, "createdAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "registration_payment_nonnegative" CHECK ("amount" >= 0 AND "players" >= 0 AND "rosterSize" BETWEEN 2 AND 3)
    )`);
    await queryRunner.query('CREATE INDEX "registration_payments_registration" ON "registration_payments" ("registrationId")');
    // Freeze the amounts previously shown in Caja; do not infer undocumented extra payments.
    await queryRunner.query(`INSERT INTO "registration_payments" ("registrationId", "kind", "players", "rosterSize", "amount", "storedName", "originalName", "mimeType", "sizeBytes", "createdAt")
      SELECT "id", 'INITIAL', CASE WHEN "playerThreeName" IS NOT NULL AND "playerThreeName" <> '' THEN 3 ELSE 2 END,
        CASE WHEN "playerThreeName" IS NOT NULL AND "playerThreeName" <> '' THEN 3 ELSE 2 END,
        CASE WHEN "feeWaived" THEN 0 ELSE (CASE WHEN "playerThreeName" IS NOT NULL AND "playerThreeName" <> '' THEN 3 ELSE 2 END) * "feePerPlayer" END,
        "paymentProofStoredName", COALESCE("paymentProofOriginalName", 'comprobante'), COALESCE("paymentProofMimeType", 'application/octet-stream'), "paymentProofSizeBytes", "createdAt"
      FROM "pair_registrations" WHERE "paymentProofStoredName" IS NOT NULL`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    const [row] = await queryRunner.query(`SELECT count(*)::int AS count FROM "registration_payments" WHERE "kind" <> 'INITIAL'`);
    if (row.count) throw new Error('No se puede revertir: existen comprobantes adicionales que deben conservarse.');
    await queryRunner.query('DROP TABLE "registration_payments"');
  }
}
