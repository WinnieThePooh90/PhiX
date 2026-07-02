-- Referat: Auswertungshilfe (Punkte je Kriterium) pro Eintrag
-- Idempotent: ReferatEntry existiert erst in einer späteren Migration (20260625120000).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ReferatEntry'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ReferatEntry' AND column_name = 'auswertungHilfe'
  ) THEN
    ALTER TABLE "ReferatEntry" ADD COLUMN "auswertungHilfe" JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;
