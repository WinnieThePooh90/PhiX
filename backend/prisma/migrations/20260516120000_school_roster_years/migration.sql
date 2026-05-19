-- Schuljahre für die Schülerverwaltung; bestehende Schüler → „Bestand“

CREATE TABLE "SchoolRosterYear" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolRosterYear_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolRosterYear_label_key" ON "SchoolRosterYear"("label");

ALTER TABLE "SchoolRosterStudent" ADD COLUMN "schoolYearId" INTEGER;

INSERT INTO "SchoolRosterYear" ("label")
SELECT 'Bestand'
WHERE EXISTS (SELECT 1 FROM "SchoolRosterStudent");

UPDATE "SchoolRosterStudent"
SET "schoolYearId" = (SELECT "id" FROM "SchoolRosterYear" WHERE "label" = 'Bestand' LIMIT 1)
WHERE "schoolYearId" IS NULL
  AND EXISTS (SELECT 1 FROM "SchoolRosterYear" WHERE "label" = 'Bestand');

ALTER TABLE "SchoolRosterStudent" ALTER COLUMN "schoolYearId" SET NOT NULL;

ALTER TABLE "SchoolRosterStudent" ADD CONSTRAINT "SchoolRosterStudent_schoolYearId_fkey"
    FOREIGN KEY ("schoolYearId") REFERENCES "SchoolRosterYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "SchoolRosterStudent_gradeLevel_idx";
CREATE INDEX "SchoolRosterStudent_schoolYearId_gradeLevel_idx" ON "SchoolRosterStudent"("schoolYearId", "gradeLevel");
