-- Zwischenspeicher für erweiterte Gewichtungsoptionen beim Ausschalten
ALTER TABLE "Course" ADD COLUMN "advancedWeightingStash" JSONB;
