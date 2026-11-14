import { MigrationInterface, QueryRunner } from 'typeorm';

export class KeepRegistrationPlayersCanonical1791504000000 implements MigrationInterface {
  name = 'KeepRegistrationPlayersCanonical1791504000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const prefix of ['playerOne', 'playerTwo', 'playerThree']) {
      await queryRunner.query(`
        UPDATE "pair_registrations" registration
        SET
          "${prefix}Name" = player."fullName",
          "${prefix}BirthDate" = COALESCE(player."birthDate", registration."${prefix}BirthDate"),
          "${prefix}Phone" = COALESCE(player.phone, registration."${prefix}Phone"),
          "${prefix}Instagram" = player.instagram,
          "${prefix}ShirtSize" = COALESCE(player."shirtSize", registration."${prefix}ShirtSize"),
          "updatedAt" = now()
        FROM players player
        WHERE player.dni = registration."${prefix}Dni"
      `);
    }

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_player_registration_snapshots()
      RETURNS trigger AS $$
      DECLARE
        previous_dni varchar;
      BEGIN
        previous_dni := NEW.dni;
        IF TG_OP = 'UPDATE' THEN
          previous_dni := OLD.dni;
        END IF;

        UPDATE "pair_registrations"
        SET "playerOneName" = NEW."fullName", "playerOneDni" = NEW.dni,
          "playerOneBirthDate" = COALESCE(NEW."birthDate", "playerOneBirthDate"),
          "playerOnePhone" = COALESCE(NEW.phone, "playerOnePhone"),
          "playerOneInstagram" = NEW.instagram,
          "playerOneShirtSize" = COALESCE(NEW."shirtSize", "playerOneShirtSize"), "updatedAt" = now()
        WHERE "playerOneDni" = previous_dni;

        UPDATE "pair_registrations"
        SET "playerTwoName" = NEW."fullName", "playerTwoDni" = NEW.dni,
          "playerTwoBirthDate" = COALESCE(NEW."birthDate", "playerTwoBirthDate"),
          "playerTwoPhone" = COALESCE(NEW.phone, "playerTwoPhone"),
          "playerTwoInstagram" = NEW.instagram,
          "playerTwoShirtSize" = COALESCE(NEW."shirtSize", "playerTwoShirtSize"), "updatedAt" = now()
        WHERE "playerTwoDni" = previous_dni;

        UPDATE "pair_registrations"
        SET "playerThreeName" = NEW."fullName", "playerThreeDni" = NEW.dni,
          "playerThreeBirthDate" = COALESCE(NEW."birthDate", "playerThreeBirthDate"),
          "playerThreePhone" = COALESCE(NEW.phone, "playerThreePhone"),
          "playerThreeInstagram" = NEW.instagram,
          "playerThreeShirtSize" = COALESCE(NEW."shirtSize", "playerThreeShirtSize"), "updatedAt" = now()
        WHERE "playerThreeDni" = previous_dni;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TR_players_sync_registration_snapshots"
      AFTER INSERT OR UPDATE OF "fullName", dni, "birthDate", phone, instagram, "shirtSize" ON players
      FOR EACH ROW EXECUTE FUNCTION sync_player_registration_snapshots()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TR_players_sync_registration_snapshots" ON players`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_player_registration_snapshots()`);
  }
}
