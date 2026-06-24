-- AlterTable
ALTER TABLE "Course" ADD COLUMN "referatFinalPercentEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "referatFinalPercent" INTEGER NOT NULL DEFAULT 100;
