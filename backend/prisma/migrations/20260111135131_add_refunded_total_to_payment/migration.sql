-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" INTEGER NOT NULL,
    "subscriptionId" INTEGER,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "receiptNumber" TEXT NOT NULL,
    "notes" TEXT,
    "transaction_ref" TEXT,
    "externalReference" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "shiftId" INTEGER,
    "createdBy" INTEGER,
    "collectorName" TEXT,
    "refundedTotal" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "POSShift" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "collectorName", "createdAt", "createdBy", "externalReference", "id", "memberId", "method", "notes", "paidAt", "receiptNumber", "shiftId", "status", "subscriptionId", "transaction_ref", "updatedAt") SELECT "amount", "collectorName", "createdAt", "createdBy", "externalReference", "id", "memberId", "method", "notes", "paidAt", "receiptNumber", "shiftId", "status", "subscriptionId", "transaction_ref", "updatedAt" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");
CREATE INDEX "Payment_transaction_ref_idx" ON "Payment"("transaction_ref");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
