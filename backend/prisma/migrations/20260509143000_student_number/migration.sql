-- Stabile Schülernummer pro Kurs
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "studentNumber" INTEGER;

-- Für bestehende Schüler: pro Kurs fortlaufend nach id vergeben
WITH numbered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY "courseId" ORDER BY id) AS rn
  FROM "Student"
  WHERE "courseId" IS NOT NULL
)
UPDATE "Student" s
SET "studentNumber" = n.rn
FROM numbered n
WHERE s.id = n.id AND (s."studentNumber" IS NULL OR s."studentNumber" = 0);

-- Fallback für evtl. kurslose Daten (Migration/Altbestand)
UPDATE "Student"
SET "studentNumber" = id
WHERE "courseId" IS NULL AND ("studentNumber" IS NULL OR "studentNumber" = 0);

ALTER TABLE "Student" ALTER COLUMN "studentNumber" SET NOT NULL;

-- Pro Kurs eindeutig
CREATE UNIQUE INDEX IF NOT EXISTS "Student_courseId_studentNumber_key"
ON "Student" ("courseId", "studentNumber");

