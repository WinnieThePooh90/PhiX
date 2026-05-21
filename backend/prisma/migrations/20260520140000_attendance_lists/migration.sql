-- CreateTable
CREATE TABLE "AttendanceList" (
    "id" SERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceListEntry" (
    "id" SERIAL NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "studentId" INTEGER NOT NULL,
    "attendanceListId" INTEGER NOT NULL,

    CONSTRAINT "AttendanceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceList_courseId_idx" ON "AttendanceList"("courseId");

-- CreateIndex
CREATE INDEX "AttendanceListEntry_attendanceListId_idx" ON "AttendanceListEntry"("attendanceListId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceListEntry_attendanceListId_studentId_key" ON "AttendanceListEntry"("attendanceListId", "studentId");

-- AddForeignKey
ALTER TABLE "AttendanceList" ADD CONSTRAINT "AttendanceList_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceListEntry" ADD CONSTRAINT "AttendanceListEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceListEntry" ADD CONSTRAINT "AttendanceListEntry_attendanceListId_fkey" FOREIGN KEY ("attendanceListId") REFERENCES "AttendanceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
