-- AlterTable
ALTER TABLE "Course" ADD COLUMN "advancedWeightingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "testsAsHalfExam" BOOLEAN NOT NULL DEFAULT false;
