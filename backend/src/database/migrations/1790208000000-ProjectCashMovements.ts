import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectCashMovements1790208000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "cash_incomes" (
      "id" SERIAL PRIMARY KEY, "concept" varchar NOT NULL, "payer" varchar, "amount" integer NOT NULL,
      "status" varchar NOT NULL DEFAULT 'PROJECTED', "expectedAt" date, "occurredAt" date,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "cash_incomes_positive_amount" CHECK ("amount" > 0),
      CONSTRAINT "cash_incomes_valid_status" CHECK ("status" IN ('PROJECTED', 'REALIZED')),
      CONSTRAINT "cash_incomes_effective_date" CHECK (("status" = 'PROJECTED' AND "occurredAt" IS NULL) OR ("status" = 'REALIZED' AND "occurredAt" IS NOT NULL))
    )`);
    await runner.query(`ALTER TABLE "cash_expenses" ADD "status" varchar NOT NULL DEFAULT 'REALIZED', ADD "expectedAt" date, ADD "occurredAt" date`);
    await runner.query(`UPDATE "cash_expenses" SET "occurredAt" = "createdAt"::date`);
    await runner.query(`ALTER TABLE "cash_expenses" ADD CONSTRAINT "cash_expenses_valid_status" CHECK ("status" IN ('PROJECTED', 'REALIZED'))`);
    await runner.query(`ALTER TABLE "cash_expenses" ADD CONSTRAINT "cash_expenses_effective_date" CHECK (("status" = 'PROJECTED' AND "occurredAt" IS NULL) OR ("status" = 'REALIZED' AND "occurredAt" IS NOT NULL))`);
  }

  async down(runner: QueryRunner): Promise<void> {
    const [income] = await runner.query('SELECT count(*)::int AS count FROM "cash_incomes"');
    const [projectedExpense] = await runner.query(`SELECT count(*)::int AS count FROM "cash_expenses" WHERE "status" = 'PROJECTED'`);
    if (income.count || projectedExpense.count) throw new Error('No se puede revertir: existen movimientos de caja nuevos o proyectados.');
    await runner.query(`ALTER TABLE "cash_expenses" DROP CONSTRAINT "cash_expenses_effective_date"`);
    await runner.query(`ALTER TABLE "cash_expenses" DROP CONSTRAINT "cash_expenses_valid_status"`);
    await runner.query(`ALTER TABLE "cash_expenses" DROP COLUMN "occurredAt", DROP COLUMN "expectedAt", DROP COLUMN "status"`);
    await runner.query('DROP TABLE "cash_incomes"');
  }
}
