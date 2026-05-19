-- Tests: Schülerdaten als erreichte Punkte (wie Klausur), nicht mehr „Fehler“
ALTER TABLE "Test" RENAME COLUMN "errors" TO "scores";
