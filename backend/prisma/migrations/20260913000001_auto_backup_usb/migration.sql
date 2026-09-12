-- AutoBackupConfig um USB-Unterstützung erweitern
ALTER TABLE "AutoBackupConfig" ADD COLUMN "usbEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AutoBackupConfig" ADD COLUMN "usbPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AutoBackupConfig" ADD COLUMN "lastStatusUsb" TEXT NOT NULL DEFAULT '';
