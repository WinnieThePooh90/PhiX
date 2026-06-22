-- AlterTable
ALTER TABLE "Course" ADD COLUMN "testsPerKlausurEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN "testsPerKlausur" INTEGER NOT NULL DEFAULT 10;
