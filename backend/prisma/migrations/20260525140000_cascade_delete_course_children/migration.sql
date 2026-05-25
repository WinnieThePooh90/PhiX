-- AlterTable: Student.courseId → ON DELETE CASCADE
ALTER TABLE "Student" DROP CONSTRAINT IF EXISTS "Student_courseId_fkey";
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Exam.courseId → ON DELETE CASCADE
ALTER TABLE "Exam" DROP CONSTRAINT IF EXISTS "Exam_courseId_fkey";
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Oral.courseId → ON DELETE CASCADE
ALTER TABLE "Oral" DROP CONSTRAINT IF EXISTS "Oral_courseId_fkey";
ALTER TABLE "Oral" ADD CONSTRAINT "Oral_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Test.courseId → ON DELETE CASCADE
ALTER TABLE "Test" DROP CONSTRAINT IF EXISTS "Test_courseId_fkey";
ALTER TABLE "Test" ADD CONSTRAINT "Test_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
