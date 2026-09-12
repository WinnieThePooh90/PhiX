-- Globale AutoBackup-Konfiguration (max. 1 Zeile, id=1)
CREATE TABLE "AutoBackupConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "localPath" TEXT NOT NULL DEFAULT 'Autobackups',
    "retentionCount" INTEGER NOT NULL DEFAULT 10,
    "remoteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "remoteProtocol" TEXT NOT NULL DEFAULT 'sftp',
    "remoteHost" TEXT NOT NULL DEFAULT '',
    "remotePort" INTEGER NOT NULL DEFAULT 22,
    "remoteUser" TEXT NOT NULL DEFAULT '',
    "remotePassword" TEXT NOT NULL DEFAULT '',
    "remotePath" TEXT NOT NULL DEFAULT '/backups',
    "lastRunAt" TIMESTAMP(3),
    "lastStatusLocal" TEXT NOT NULL DEFAULT '',
    "lastStatusRemote" TEXT NOT NULL DEFAULT '',
    "lastErrorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoBackupConfig_pkey" PRIMARY KEY ("id")
);
