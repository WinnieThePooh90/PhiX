-- Referate: Kurs-Option und Einträge (analog GFS)
ALTER TABLE "Course" ADD COLUMN "referateAccepted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReferatEntry" (
    "id" SERIAL NOT NULL,
    "thema" TEXT NOT NULL DEFAULT '',
    "art" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "gehalten" BOOLEAN NOT NULL DEFAULT false,
    "halbjahr" TEXT NOT NULL DEFAULT '1',
    "note" TEXT NOT NULL DEFAULT '',
    "auswertungHilfe" JSONB NOT NULL DEFAULT '{}',
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER,

    CONSTRAINT "ReferatEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReferatEntry" ADD CONSTRAINT "ReferatEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferatEntry" ADD CONSTRAINT "ReferatEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
