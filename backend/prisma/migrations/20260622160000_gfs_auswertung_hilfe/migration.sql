-- GFS: Auswertungshilfe (Punkte je Kriterium) pro Eintrag
ALTER TABLE "GfsEntry" ADD COLUMN "auswertungHilfe" JSONB NOT NULL DEFAULT '{}';
