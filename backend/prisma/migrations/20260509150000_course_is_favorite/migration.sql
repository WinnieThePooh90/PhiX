-- Favoriten-Markierung pro Kurs (Sidebar)
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;
