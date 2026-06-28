-- AlterTable: Gehalten-Stash für GFS/Referate beim Deaktivieren der Facheinstellung
ALTER TABLE "Course" ADD COLUMN "gfsGehaltenStash" JSONB;
ALTER TABLE "Course" ADD COLUMN "referatGehaltenStash" JSONB;
