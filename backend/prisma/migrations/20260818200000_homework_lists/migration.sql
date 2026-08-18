-- Hausaufgabenlisten (Einstellungsmenü / Hausaufgaben)
CREATE TABLE IF NOT EXISTS "HomeworkList" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Hausaufgabenliste',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HomeworkListEntry" (
    "id" SERIAL NOT NULL,
    "homeworkListId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "checks" JSONB NOT NULL DEFAULT '{}',
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HomeworkListEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HomeworkList_courseId_idx" ON "HomeworkList"("courseId");
CREATE INDEX IF NOT EXISTS "HomeworkListEntry_homeworkListId_idx" ON "HomeworkListEntry"("homeworkListId");
CREATE INDEX IF NOT EXISTS "HomeworkListEntry_studentId_idx" ON "HomeworkListEntry"("studentId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HomeworkList_courseId_fkey') THEN
        ALTER TABLE "HomeworkList" ADD CONSTRAINT "HomeworkList_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HomeworkListEntry_homeworkListId_fkey') THEN
        ALTER TABLE "HomeworkListEntry" ADD CONSTRAINT "HomeworkListEntry_homeworkListId_fkey" FOREIGN KEY ("homeworkListId") REFERENCES "HomeworkList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HomeworkListEntry_studentId_fkey') THEN
        ALTER TABLE "HomeworkListEntry" ADD CONSTRAINT "HomeworkListEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
