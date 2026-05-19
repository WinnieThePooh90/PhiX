-- CreateTable
CREATE TABLE "MoneyList" (
    "id" SERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "amountPerStudent" DOUBLE PRECISION NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyListEntry" (
    "id" SERIAL NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "studentId" INTEGER NOT NULL,
    "moneyListId" INTEGER NOT NULL,

    CONSTRAINT "MoneyListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoneyList_courseId_idx" ON "MoneyList"("courseId");

-- CreateIndex
CREATE INDEX "MoneyListEntry_moneyListId_idx" ON "MoneyListEntry"("moneyListId");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyListEntry_moneyListId_studentId_key" ON "MoneyListEntry"("moneyListId", "studentId");

-- AddForeignKey
ALTER TABLE "MoneyList" ADD CONSTRAINT "MoneyList_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyListEntry" ADD CONSTRAINT "MoneyListEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyListEntry" ADD CONSTRAINT "MoneyListEntry_moneyListId_fkey" FOREIGN KEY ("moneyListId") REFERENCES "MoneyList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
