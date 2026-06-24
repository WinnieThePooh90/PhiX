-- AlterTable
ALTER TABLE "Course" ADD COLUMN "referatAsExam" BOOLEAN NOT NULL DEFAULT false;

-- Bestehende Kurse mit Referaten: bisheriges Verhalten beibehalten
UPDATE "Course" SET "referatAsExam" = true WHERE "referateAccepted" = true;
