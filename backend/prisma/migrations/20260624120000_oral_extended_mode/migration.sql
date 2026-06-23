-- Erweiterter Mündlich-Modus: off | points | grades (ersetzt boolean extended)
ALTER TABLE "Oral" ADD COLUMN "extendedMode" TEXT NOT NULL DEFAULT 'off';
UPDATE "Oral" SET "extendedMode" = 'points' WHERE "extended" = true;
ALTER TABLE "Oral" DROP COLUMN "extended";
