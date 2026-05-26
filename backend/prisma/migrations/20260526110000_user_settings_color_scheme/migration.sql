-- AlterTable: UserSettings – colorScheme hinzufügen
ALTER TABLE "UserSettings" ADD COLUMN "colorScheme" TEXT NOT NULL DEFAULT 'standard';
