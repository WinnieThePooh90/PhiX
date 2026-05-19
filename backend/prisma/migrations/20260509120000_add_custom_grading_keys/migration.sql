-- Benutzerdefinierte Notenschlüssel pro Kurs (JSON-Array)
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "customGradingKeys" JSONB NOT NULL DEFAULT '[]';
