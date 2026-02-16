-- CreateTable
CREATE TABLE "PackagePlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "price" REAL NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "validityDays" INTEGER,
    "description" TEXT,
    "descriptionAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "businessTypeScope" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MemberPackage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" INTEGER NOT NULL,
    "packagePlanId" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "totalSessionsSnapshot" INTEGER NOT NULL,
    "remainingSessions" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByEmployeeId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberPackage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberPackage_packagePlanId_fkey" FOREIGN KEY ("packagePlanId") REFERENCES "PackagePlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MemberPackage_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackageSessionUsage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" INTEGER NOT NULL,
    "memberPackageId" INTEGER NOT NULL,
    "dateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'CHECKIN',
    "createdByEmployeeId" INTEGER,
    "notes" TEXT,
    CONSTRAINT "PackageSessionUsage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PackageSessionUsage_memberPackageId_fkey" FOREIGN KEY ("memberPackageId") REFERENCES "MemberPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PackageSessionUsage_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MemberPackage_memberId_status_idx" ON "MemberPackage"("memberId", "status");

-- CreateIndex
CREATE INDEX "PackageSessionUsage_memberId_dateTime_idx" ON "PackageSessionUsage"("memberId", "dateTime");
