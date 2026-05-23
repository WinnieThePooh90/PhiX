-- UserCrypto + Schülerverwaltung pro Benutzer + verschlüsselbare Datums-Strings

CREATE TABLE "UserCrypto" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "cryptoVersion" INTEGER NOT NULL DEFAULT 1,
    "kdfSaltPassword" TEXT NOT NULL,
    "kdfSaltRecovery" TEXT NOT NULL,
    "dekWrappedPassword" TEXT NOT NULL,
    "dekWrappedRecovery" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCrypto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCrypto_userId_key" ON "UserCrypto"("userId");

ALTER TABLE "UserCrypto" ADD CONSTRAINT "UserCrypto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolRosterYear" ADD COLUMN "ownerUsername" TEXT NOT NULL DEFAULT 'admin';

UPDATE "SchoolRosterYear" SET "ownerUsername" = 'admin' WHERE "ownerUsername" IS NULL OR "ownerUsername" = '';

DROP INDEX IF EXISTS "SchoolRosterYear_label_key";

CREATE INDEX "SchoolRosterYear_ownerUsername_idx" ON "SchoolRosterYear"("ownerUsername");

CREATE UNIQUE INDEX "SchoolRosterYear_ownerUsername_label_key" ON "SchoolRosterYear"("ownerUsername", "label");

ALTER TABLE "MoneyList" ALTER COLUMN "dueDate" DROP NOT NULL;
ALTER TABLE "MoneyList" ALTER COLUMN "dueDate" SET DATA TYPE TEXT USING (
  CASE WHEN "dueDate" IS NULL THEN NULL ELSE to_char("dueDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END
);

ALTER TABLE "AttendanceList" ALTER COLUMN "sessionDate" DROP NOT NULL;
ALTER TABLE "AttendanceList" ALTER COLUMN "sessionDate" SET DATA TYPE TEXT USING (
  CASE WHEN "sessionDate" IS NULL THEN NULL ELSE to_char("sessionDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END
);

ALTER TABLE "CollectionList" ALTER COLUMN "sessionDate" DROP NOT NULL;
ALTER TABLE "CollectionList" ALTER COLUMN "sessionDate" SET DATA TYPE TEXT USING (
  CASE WHEN "sessionDate" IS NULL THEN NULL ELSE to_char("sessionDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END
);

ALTER TABLE "NotesList" ALTER COLUMN "sessionDate" DROP NOT NULL;
ALTER TABLE "NotesList" ALTER COLUMN "sessionDate" SET DATA TYPE TEXT USING (
  CASE WHEN "sessionDate" IS NULL THEN NULL ELSE to_char("sessionDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END
);
