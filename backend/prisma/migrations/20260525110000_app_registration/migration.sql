-- Globale App-Registrierung (max. 1 Zeile, id=1)
CREATE TABLE "AppRegistration" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AppRegistration_pkey" PRIMARY KEY ("id")
);
