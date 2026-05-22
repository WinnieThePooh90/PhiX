-- CreateTable
CREATE TABLE "NotesList" (
    "id" SERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "includeExternal" BOOLEAN NOT NULL DEFAULT false,
    "externalOnly" BOOLEAN NOT NULL DEFAULT false,
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotesList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotesListEntry" (
    "id" SERIAL NOT NULL,
    "remark" TEXT NOT NULL DEFAULT '',
    "studentId" INTEGER,
    "externalFirstName" TEXT NOT NULL DEFAULT '',
    "externalLastName" TEXT NOT NULL DEFAULT '',
    "notesListId" INTEGER NOT NULL,

    CONSTRAINT "NotesListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotesList_courseId_idx" ON "NotesList"("courseId");

-- CreateIndex
CREATE INDEX "NotesListEntry_notesListId_idx" ON "NotesListEntry"("notesListId");

-- CreateIndex
CREATE UNIQUE INDEX "NotesListEntry_notesListId_studentId_key" ON "NotesListEntry"("notesListId", "studentId");

-- AddForeignKey
ALTER TABLE "NotesList" ADD CONSTRAINT "NotesList_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotesListEntry" ADD CONSTRAINT "NotesListEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotesListEntry" ADD CONSTRAINT "NotesListEntry_notesListId_fkey" FOREIGN KEY ("notesListId") REFERENCES "NotesList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
