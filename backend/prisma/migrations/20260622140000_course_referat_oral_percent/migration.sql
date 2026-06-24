-- AlterTable
ALTER TABLE "Course" ADD COLUMN "referatOralPercentEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "referatOralPercent" INTEGER NOT NULL DEFAULT 100;
