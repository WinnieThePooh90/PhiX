-- Passwort nur vom Benutzer selbst (Erst-Login / eigenes Ändern)
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "mustSetPassword" BOOLEAN NOT NULL DEFAULT false;
