-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "posAmountVerified" REAL;
ALTER TABLE "Payment" ADD COLUMN "verificationMode" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_POSShift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "machineId" INTEGER NOT NULL,
    "openedBy" INTEGER NOT NULL,
    "closedBy" INTEGER,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "openingCash" REAL NOT NULL,
    "closingCash" REAL,
    "expectedCash" REAL,
    "cashDifference" REAL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "activityType" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    CONSTRAINT "POSShift_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "POSMachine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "POSShift_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "POSShift_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_POSShift" ("cashDifference", "closedAt", "closedBy", "closingCash", "expectedCash", "id", "machineId", "openedAt", "openedBy", "openingCash", "status") SELECT "cashDifference", "closedAt", "closedBy", "closingCash", "expectedCash", "id", "machineId", "openedAt", "openedBy", "openingCash", "status" FROM "POSShift";
DROP TABLE "POSShift";
ALTER TABLE "new_POSShift" RENAME TO "POSShift";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
