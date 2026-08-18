-- CreateTable
CREATE TABLE "HomeworkList" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Hausaufgabenliste',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkListEntry" (
    "id" SERIAL NOT NULL,
    "homeworkListId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "checks" JSONB NOT NULL DEFAULT '{}',
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HomeworkListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkList_courseId_idx" ON "HomeworkList"("courseId");

-- CreateIndex
CREATE INDEX "HomeworkListEntry_homeworkListId_idx" ON "HomeworkListEntry"("homeworkListId");

-- CreateIndex
CREATE INDEX "HomeworkListEntry_studentId_idx" ON "HomeworkListEntry"("studentId");

-- AddForeignKey
ALTER TABLE "HomeworkList" ADD CONSTRAINT "HomeworkList_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkListEntry" ADD CONSTRAINT "HomeworkListEntry_homeworkListId_fkey" FOREIGN KEY ("homeworkListId") REFERENCES "HomeworkList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkListEntry" ADD CONSTRAINT "HomeworkListEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
