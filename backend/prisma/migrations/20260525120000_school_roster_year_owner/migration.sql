-- SchoolRosterYear: ownerUsername hinzufügen + Unique-Index anpassen

ALTER TABLE "SchoolRosterYear" ADD COLUMN IF NOT EXISTS "ownerUsername" TEXT NOT NULL DEFAULT 'admin';

-- Alten Unique-Index (nur label) entfernen, neuen (ownerUsername, label) erstellen
DROP INDEX IF EXISTS "SchoolRosterYear_label_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolRosterYear_ownerUsername_label_key" ON "SchoolRosterYear"("ownerUsername", "label");
CREATE INDEX IF NOT EXISTS "SchoolRosterYear_ownerUsername_idx" ON "SchoolRosterYear"("ownerUsername");
