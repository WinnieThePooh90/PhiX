-- CreateTable
CREATE TABLE "CollectionList" (
    "id" SERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "courseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionListEntry" (
    "id" SERIAL NOT NULL,
    "collected" BOOLEAN NOT NULL DEFAULT false,
    "studentId" INTEGER NOT NULL,
    "collectionListId" INTEGER NOT NULL,

    CONSTRAINT "CollectionListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionList_courseId_idx" ON "CollectionList"("courseId");

-- CreateIndex
CREATE INDEX "CollectionListEntry_collectionListId_idx" ON "CollectionListEntry"("collectionListId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionListEntry_collectionListId_studentId_key" ON "CollectionListEntry"("collectionListId", "studentId");

-- AddForeignKey
ALTER TABLE "CollectionList" ADD CONSTRAINT "CollectionList_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionListEntry" ADD CONSTRAINT "CollectionListEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionListEntry" ADD CONSTRAINT "CollectionListEntry_collectionListId_fkey" FOREIGN KEY ("collectionListId") REFERENCES "CollectionList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
