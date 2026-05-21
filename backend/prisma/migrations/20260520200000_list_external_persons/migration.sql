-- MoneyList
ALTER TABLE "MoneyList" ADD COLUMN "includeExternal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MoneyList" ADD COLUMN "externalOnly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MoneyListEntry" ADD COLUMN "externalFirstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MoneyListEntry" ADD COLUMN "externalLastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MoneyListEntry" ALTER COLUMN "studentId" DROP NOT NULL;

-- AttendanceList
ALTER TABLE "AttendanceList" ADD COLUMN "includeExternal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceList" ADD COLUMN "externalOnly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AttendanceListEntry" ADD COLUMN "externalFirstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AttendanceListEntry" ADD COLUMN "externalLastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AttendanceListEntry" ALTER COLUMN "studentId" DROP NOT NULL;

-- CollectionList
ALTER TABLE "CollectionList" ADD COLUMN "includeExternal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollectionList" ADD COLUMN "externalOnly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CollectionListEntry" ADD COLUMN "externalFirstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CollectionListEntry" ADD COLUMN "externalLastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CollectionListEntry" ALTER COLUMN "studentId" DROP NOT NULL;
