import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repairs the historical split between the Players ABM and pair registrations.
 * A locality currently represents one team, so a locality with exactly one
 * registration and exactly 2/3 players has an unambiguous tournament roster.
 * Ambiguous localities are intentionally left untouched for manual resolution.
 */
export class MakePlayersCanonicalForTeamRosters1790812800000 implements MigrationInterface {
  name = 'MakePlayersCanonicalForTeamRosters1790812800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH unambiguous AS (
        SELECT
          registration.id AS "registrationId",
          ARRAY_AGG(player.id ORDER BY player.id) AS "playerIds"
        FROM "pair_registrations" registration
        INNER JOIN "players" player ON player."localityId" = registration."localityId"
        WHERE (
          SELECT COUNT(*)
          FROM "pair_registrations" other_registration
          WHERE other_registration."localityId" = registration."localityId"
        ) = 1
        GROUP BY registration.id
        HAVING COUNT(player.id) BETWEEN 2 AND 3
      ), old_metadata AS (
        SELECT id AS "registrationId", "playerOneDni" AS dni,
          "playerOneHasCommercialAgreement" AS "hasCommercialAgreement",
          "playerOneCommercialAgreementDetails" AS "commercialAgreementDetails",
          "playerOnePhotoStoredName" AS "photoStoredName", "playerOnePhotoOriginalName" AS "photoOriginalName",
          "playerOnePhotoMimeType" AS "photoMimeType", "playerOnePhotoSizeBytes" AS "photoSizeBytes"
        FROM "pair_registrations"
        UNION ALL
        SELECT id, "playerTwoDni", "playerTwoHasCommercialAgreement", "playerTwoCommercialAgreementDetails",
          "playerTwoPhotoStoredName", "playerTwoPhotoOriginalName", "playerTwoPhotoMimeType", "playerTwoPhotoSizeBytes"
        FROM "pair_registrations"
        UNION ALL
        SELECT id, "playerThreeDni", "playerThreeHasCommercialAgreement", "playerThreeCommercialAgreementDetails",
          "playerThreePhotoStoredName", "playerThreePhotoOriginalName", "playerThreePhotoMimeType", "playerThreePhotoSizeBytes"
        FROM "pair_registrations"
        WHERE "playerThreeDni" IS NOT NULL
      ), roster AS (
        SELECT
          unambiguous."registrationId",
          player.*,
          position.ordinality AS position,
          old_metadata."hasCommercialAgreement", old_metadata."commercialAgreementDetails",
          old_metadata."photoStoredName", old_metadata."photoOriginalName",
          old_metadata."photoMimeType", old_metadata."photoSizeBytes"
        FROM unambiguous
        CROSS JOIN LATERAL UNNEST(unambiguous."playerIds") WITH ORDINALITY AS position("playerId", ordinality)
        INNER JOIN "players" player ON player.id = position."playerId"
        LEFT JOIN old_metadata ON old_metadata."registrationId" = unambiguous."registrationId" AND old_metadata.dni = player.dni
      )
      UPDATE "pair_registrations" registration
      SET
        "playerOneName" = one."fullName",
        "playerOneDni" = one.dni,
        "playerOneBirthDate" = COALESCE(one."birthDate", registration."playerOneBirthDate"),
        "playerOnePhone" = COALESCE(one.phone, registration."playerOnePhone"),
        "playerOneInstagram" = one.instagram,
        "playerOneShirtSize" = COALESCE(one."shirtSize", registration."playerOneShirtSize"),
        "playerOneHasCommercialAgreement" = COALESCE(one."hasCommercialAgreement", false),
        "playerOneCommercialAgreementDetails" = one."commercialAgreementDetails",
        "playerOnePhotoStoredName" = one."photoStoredName",
        "playerOnePhotoOriginalName" = one."photoOriginalName",
        "playerOnePhotoMimeType" = one."photoMimeType",
        "playerOnePhotoSizeBytes" = one."photoSizeBytes",
        "playerTwoName" = two."fullName",
        "playerTwoDni" = two.dni,
        "playerTwoBirthDate" = COALESCE(two."birthDate", registration."playerTwoBirthDate"),
        "playerTwoPhone" = COALESCE(two.phone, registration."playerTwoPhone"),
        "playerTwoInstagram" = two.instagram,
        "playerTwoShirtSize" = COALESCE(two."shirtSize", registration."playerTwoShirtSize"),
        "playerTwoHasCommercialAgreement" = COALESCE(two."hasCommercialAgreement", false),
        "playerTwoCommercialAgreementDetails" = two."commercialAgreementDetails",
        "playerTwoPhotoStoredName" = two."photoStoredName",
        "playerTwoPhotoOriginalName" = two."photoOriginalName",
        "playerTwoPhotoMimeType" = two."photoMimeType",
        "playerTwoPhotoSizeBytes" = two."photoSizeBytes",
        "playerThreeName" = three."fullName",
        "playerThreeDni" = three.dni,
        "playerThreeBirthDate" = three."birthDate",
        "playerThreePhone" = three.phone,
        "playerThreeInstagram" = three.instagram,
        "playerThreeShirtSize" = three."shirtSize",
        "playerThreeHasCommercialAgreement" = COALESCE(three."hasCommercialAgreement", false),
        "playerThreeCommercialAgreementDetails" = three."commercialAgreementDetails",
        "playerThreePhotoStoredName" = three."photoStoredName",
        "playerThreePhotoOriginalName" = three."photoOriginalName",
        "playerThreePhotoMimeType" = three."photoMimeType",
        "playerThreePhotoSizeBytes" = three."photoSizeBytes",
        "updatedAt" = now()
      FROM roster one
      INNER JOIN roster two ON two."registrationId" = one."registrationId" AND two.position = 2
      LEFT JOIN roster three ON three."registrationId" = one."registrationId" AND three.position = 3
      WHERE registration.id = one."registrationId" AND one.position = 1
    `);
  }

  async down(): Promise<void> {
    // The previous inconsistent values cannot be reconstructed safely.
  }
}
