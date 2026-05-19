-- Früherer Fest-Schlüssel „10“ entfernt: auf Standard-Schlüssel 1 migrieren
UPDATE "Test" SET "keyType" = '1' WHERE "keyType" = '10';
