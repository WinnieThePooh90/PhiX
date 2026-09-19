-- SchoolRosterYear: isGlobal hinzufügen + Unique-Index anpassen
ALTER TABLE "SchoolRosterYear" ADD COLUMN IF NOT EXISTS "isGlobal" BOOLEAN NOT NULL DEFAULT false;

-- SchoolRosterStudent: isGlobal und ownerUsername hinzufügen
ALTER TABLE "SchoolRosterStudent" ADD COLUMN IF NOT EXISTS "isGlobal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SchoolRosterStudent" ADD COLUMN IF NOT EXISTS "ownerUsername" TEXT;

-- Indizes aktualisieren
DROP INDEX IF EXISTS "SchoolRosterYear_ownerUsername_label_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolRosterYear_isGlobal_ownerUsername_label_key" ON "SchoolRosterYear"("isGlobal", "ownerUsername", "label");
CREATE INDEX IF NOT EXISTS "SchoolRosterYear_isGlobal_idx" ON "SchoolRosterYear"("isGlobal");
CREATE INDEX IF NOT EXISTS "SchoolRosterStudent_schoolYearId_isGlobal_ownerUsername_idx" ON "SchoolRosterStudent"("schoolYearId", "isGlobal", "ownerUsername");
