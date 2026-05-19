-- Tab GFS ausblenden, wenn keine GFS angenommen werden
ALTER TABLE "Course" ADD COLUMN "gfsAccepted" BOOLEAN NOT NULL DEFAULT true;
