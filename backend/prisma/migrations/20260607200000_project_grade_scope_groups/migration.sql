-- AlterTable
ALTER TABLE "Project" ADD COLUMN "gradeScope" TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE "Project" ADD COLUMN "groups" JSONB NOT NULL DEFAULT '{}';
