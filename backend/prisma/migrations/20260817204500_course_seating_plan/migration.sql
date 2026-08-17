-- Sitzplan-Konfiguration (Raster-Form & Belegung)
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "seatingPlan" JSONB;
