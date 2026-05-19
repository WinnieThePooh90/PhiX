-- Mündlich: Aktiv-Schalter wie bei Klausuren
ALTER TABLE "Oral" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
