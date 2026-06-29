-- SchoolRosterStudent: Teilklasse (z. B. a, b, c)
ALTER TABLE "SchoolRosterStudent" ADD COLUMN IF NOT EXISTS "classSection" TEXT NOT NULL DEFAULT '';
