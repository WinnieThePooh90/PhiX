-- Manuelle Endnote pro Schüler (Gesamtübersicht)
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "summaryEndNote" TEXT NOT NULL DEFAULT '';
