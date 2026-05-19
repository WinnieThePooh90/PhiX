-- Tests: Skala für Fehler→Prozent (wie Klausur-Maximalpunkte), Standard 10
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "maxPoints" DOUBLE PRECISION NOT NULL DEFAULT 10;
