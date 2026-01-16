-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "collectorName" TEXT;

-- CreateTable
CREATE TABLE "CashClosing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER,
    "employeeName" TEXT,
    "periodType" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "expectedCashAmount" REAL NOT NULL DEFAULT 0,
    "expectedNonCashAmount" REAL NOT NULL DEFAULT 0,
    "expectedTotalAmount" REAL NOT NULL DEFAULT 0,
    "declaredCashAmount" REAL NOT NULL DEFAULT 0,
    "declaredNonCashAmount" REAL NOT NULL DEFAULT 0,
    "declaredTotalAmount" REAL NOT NULL DEFAULT 0,
    "differenceCash" REAL NOT NULL DEFAULT 0,
    "differenceNonCash" REAL NOT NULL DEFAULT 0,
    "differenceTotal" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashClosing_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashClosing_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "performedBy" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    CONSTRAINT "AuditLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
