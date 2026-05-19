-- AlterTable
ALTER TABLE "Course" ADD COLUMN "ownerUsername" TEXT NOT NULL DEFAULT 'admin';

-- CreateIndex
CREATE INDEX "Course_ownerUsername_idx" ON "Course"("ownerUsername");
