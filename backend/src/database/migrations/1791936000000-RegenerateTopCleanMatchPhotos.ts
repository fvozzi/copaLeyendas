import { MigrationInterface, QueryRunner } from 'typeorm';

export class RegenerateTopCleanMatchPhotos1791936000000 implements MigrationInterface {
  name = 'RegenerateTopCleanMatchPhotos1791936000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('UPDATE "tournament_matches" SET "resultCleanPhotoStoredName" = NULL WHERE "resultCleanPhotoStoredName" IS NOT NULL');
  }

  async down(): Promise<void> {
    // Generated derivatives cannot be restored; they are recreated on demand.
  }
}
