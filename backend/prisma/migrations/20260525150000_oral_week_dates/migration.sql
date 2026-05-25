-- AlterTable: Oral – weekDates-Spalte hinzufügen, weekCount-Default auf 0
ALTER TABLE "Oral" ADD COLUMN "weekDates" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Oral" ALTER COLUMN "weekCount" SET DEFAULT 0;
