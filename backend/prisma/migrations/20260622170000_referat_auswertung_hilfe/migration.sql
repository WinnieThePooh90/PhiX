-- Referat: Auswertungshilfe (Punkte je Kriterium) pro Eintrag
ALTER TABLE "ReferatEntry" ADD COLUMN "auswertungHilfe" JSONB NOT NULL DEFAULT '{}';
