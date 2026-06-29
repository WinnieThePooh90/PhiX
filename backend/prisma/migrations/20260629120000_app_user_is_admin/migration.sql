-- AppUser: optionale Admin-Rechte (zusätzlich zum System-Benutzer „admin“)
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AppUser" SET "isAdmin" = true WHERE LOWER("username") = 'admin';
