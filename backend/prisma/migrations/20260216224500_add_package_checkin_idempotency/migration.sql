-- Add package defaults on purchased package
ALTER TABLE "MemberPackage" ADD COLUMN "sessionName" TEXT;
ALTER TABLE "MemberPackage" ADD COLUMN "sessionPrice" REAL;

PRAGMA foreign_keys=OFF;

-- Rebuild package usage table to add checkIn link + session snapshots
CREATE TABLE "new_PackageSessionUsage" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "memberId" INTEGER NOT NULL,
  "memberPackageId" INTEGER NOT NULL,
  "checkInId" INTEGER,
  "sessionName" TEXT,
  "sessionPrice" REAL,
  "dateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'CHECKIN',
  "createdByEmployeeId" INTEGER,
  "notes" TEXT,
  CONSTRAINT "PackageSessionUsage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PackageSessionUsage_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "MemberPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PackageSessionUsage_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "CheckIn" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PackageSessionUsage_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_PackageSessionUsage" (
  "id",
  "memberId",
  "memberPackageId",
  "dateTime",
  "source",
  "createdByEmployeeId",
  "notes"
)
SELECT
  "id",
  "memberId",
  "memberPackageId",
  "dateTime",
  "source",
  "createdByEmployeeId",
  "notes"
FROM "PackageSessionUsage";

DROP TABLE "PackageSessionUsage";
ALTER TABLE "new_PackageSessionUsage" RENAME TO "PackageSessionUsage";

CREATE INDEX "PackageSessionUsage_memberId_dateTime_idx" ON "PackageSessionUsage"("memberId", "dateTime");
CREATE INDEX "PackageSessionUsage_memberPackageId_dateTime_idx" ON "PackageSessionUsage"("memberPackageId", "dateTime");
CREATE INDEX "PackageSessionUsage_checkInId_idx" ON "PackageSessionUsage"("checkInId");

-- Persist check-in idempotency keys to prevent duplicate package consumption
CREATE TABLE "CheckInIdempotency" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "idempotencyKey" TEXT NOT NULL,
  "memberId" INTEGER NOT NULL,
  "memberPackageId" INTEGER,
  "checkInId" INTEGER,
  "responseJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckInIdempotency_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CheckInIdempotency_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "MemberPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CheckInIdempotency_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "CheckIn" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CheckInIdempotency_idempotencyKey_key" ON "CheckInIdempotency"("idempotencyKey");
CREATE INDEX "CheckInIdempotency_memberId_createdAt_idx" ON "CheckInIdempotency"("memberId", "createdAt");
CREATE INDEX "CheckInIdempotency_memberPackageId_createdAt_idx" ON "CheckInIdempotency"("memberPackageId", "createdAt");

PRAGMA foreign_keys=ON;
