-- Schulweite Schülerliste (Klassenstufe 5–13, unabhängig von Kurs-Schülern)

CREATE TABLE "SchoolRosterStudent" (
    "id" SERIAL NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolRosterStudent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchoolRosterStudent_gradeLevel_idx" ON "SchoolRosterStudent"("gradeLevel");
