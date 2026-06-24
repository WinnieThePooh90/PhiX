-- AlterTable
ALTER TABLE "Course" ADD COLUMN "referatWrittenPercentEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "referatWrittenPercent" INTEGER NOT NULL DEFAULT 100;
