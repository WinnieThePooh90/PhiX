-- CreateTable
CREATE TABLE "AppUser" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" SERIAL NOT NULL,
    "year" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "weighting" JSONB NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "year" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "weighting" JSONB NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" SERIAL NOT NULL,
    "frontendId" BIGINT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "courseId" INTEGER,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GfsEntry" (
    "id" SERIAL NOT NULL,
    "thema" TEXT NOT NULL DEFAULT '',
    "art" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "gehalten" BOOLEAN NOT NULL DEFAULT false,
    "halbjahr" TEXT NOT NULL DEFAULT '1',
    "note" TEXT NOT NULL DEFAULT '',
    "studentId" INTEGER NOT NULL,
    "courseId" INTEGER,

    CONSTRAINT "GfsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "examNumber" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "numFields" INTEGER NOT NULL,
    "fieldMaxPoints" JSONB NOT NULL,
    "keyType" TEXT NOT NULL,
    "date" TEXT NOT NULL DEFAULT '',
    "halbjahr" TEXT NOT NULL DEFAULT '1',
    "name" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "courseId" INTEGER,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oral" (
    "id" SERIAL NOT NULL,
    "oralNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL DEFAULT '',
    "halbjahr" TEXT NOT NULL DEFAULT '1',
    "extended" BOOLEAN NOT NULL DEFAULT false,
    "weekCount" INTEGER NOT NULL DEFAULT 1,
    "bestNote" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "worstNote" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "weekSpread" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "grades" JSONB NOT NULL,
    "courseId" INTEGER,

    CONSTRAINT "Oral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Test" (
    "id" SERIAL NOT NULL,
    "testNumber" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "keyType" TEXT NOT NULL,
    "date" TEXT NOT NULL DEFAULT '',
    "halbjahr" TEXT NOT NULL DEFAULT '1',
    "name" TEXT NOT NULL,
    "errors" JSONB NOT NULL,
    "courseId" INTEGER,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_username_key" ON "AppUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Student_frontendId_key" ON "Student"("frontendId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GfsEntry" ADD CONSTRAINT "GfsEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GfsEntry" ADD CONSTRAINT "GfsEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oral" ADD CONSTRAINT "Oral_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
