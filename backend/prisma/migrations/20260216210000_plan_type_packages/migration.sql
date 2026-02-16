-- Add plan type + package fields to subscription plans
ALTER TABLE "SubscriptionPlan" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'MEMBERSHIP';
ALTER TABLE "SubscriptionPlan" ADD COLUMN "packageTotalSessions" INTEGER;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "packageValidityDays" INTEGER;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "packageSessionServiceId" INTEGER;

-- Prepare offset for migrating package plans into subscription plans
CREATE TABLE IF NOT EXISTS "_PackagePlanOffset" (
  "offset" INTEGER NOT NULL
);
DELETE FROM "_PackagePlanOffset";
INSERT INTO "_PackagePlanOffset" ("offset")
SELECT IFNULL(MAX("id"), 0) FROM "SubscriptionPlan";

-- Move PackagePlan rows into SubscriptionPlan as type=PACKAGE
INSERT INTO "SubscriptionPlan" (
  "id",
  "name",
  "nameAr",
  "type",
  "duration",
  "durationType",
  "price",
  "packageTotalSessions",
  "packageValidityDays",
  "packageSessionServiceId",
  "description",
  "descriptionAr",
  "features",
  "isActive",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  "PackagePlan"."id" + "_PackagePlanOffset"."offset",
  "PackagePlan"."name",
  "PackagePlan"."nameAr",
  'PACKAGE',
  COALESCE("PackagePlan"."validityDays", 1),
  'days',
  "PackagePlan"."price",
  "PackagePlan"."totalSessions",
  "PackagePlan"."validityDays",
  NULL,
  "PackagePlan"."description",
  "PackagePlan"."descriptionAr",
  NULL,
  "PackagePlan"."isActive",
  "PackagePlan"."sortOrder",
  "PackagePlan"."createdAt",
  "PackagePlan"."updatedAt"
FROM "PackagePlan", "_PackagePlanOffset";

-- Rebuild MemberPackage with planId + totalSessions
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_MemberPackage" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "memberId" INTEGER NOT NULL,
  "planId" INTEGER NOT NULL,
  "startDate" DATETIME NOT NULL,
  "endDate" DATETIME,
  "totalSessions" INTEGER NOT NULL,
  "remainingSessions" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByEmployeeId" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MemberPackage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberPackage_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MemberPackage_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_MemberPackage" (
  "id",
  "memberId",
  "planId",
  "startDate",
  "endDate",
  "totalSessions",
  "remainingSessions",
  "status",
  "createdByEmployeeId",
  "createdAt",
  "updatedAt"
)
SELECT
  "MemberPackage"."id",
  "MemberPackage"."memberId",
  "MemberPackage"."packagePlanId" + (SELECT "offset" FROM "_PackagePlanOffset"),
  "MemberPackage"."startDate",
  "MemberPackage"."endDate",
  "MemberPackage"."totalSessionsSnapshot",
  "MemberPackage"."remainingSessions",
  CASE "MemberPackage"."status"
    WHEN 'DEPLETED' THEN 'COMPLETED'
    WHEN 'CANCELED' THEN 'PAUSED'
    ELSE "MemberPackage"."status"
  END,
  "MemberPackage"."createdByEmployeeId",
  "MemberPackage"."createdAt",
  "MemberPackage"."updatedAt"
FROM "MemberPackage";

DROP TABLE "MemberPackage";
ALTER TABLE "new_MemberPackage" RENAME TO "MemberPackage";

CREATE INDEX "MemberPackage_memberId_status_idx" ON "MemberPackage"("memberId", "status");
CREATE INDEX "MemberPackage_planId_idx" ON "MemberPackage"("planId");
CREATE INDEX "MemberPackage_endDate_idx" ON "MemberPackage"("endDate");

-- Cleanup legacy package plans
DROP TABLE "PackagePlan";
DROP TABLE "_PackagePlanOffset";

PRAGMA foreign_keys=ON;
