-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "projectNumber" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weightingMode" TEXT NOT NULL DEFAULT 'written',
    "weightPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "numFields" INTEGER NOT NULL,
    "fieldMaxPoints" JSONB NOT NULL,
    "keyType" TEXT NOT NULL,
    "date" TEXT NOT NULL DEFAULT '',
    "halbjahr" TEXT NOT NULL DEFAULT '1',
    "scores" JSONB NOT NULL,
    "courseId" INTEGER,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
