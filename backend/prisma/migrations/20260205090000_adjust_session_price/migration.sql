-- Add price adjustment fields
ALTER TABLE "Appointment" ADD COLUMN "finalPrice" REAL;
ALTER TABLE "Appointment" ADD COLUMN "dueAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Appointment" ADD COLUMN "overpaidAmount" REAL NOT NULL DEFAULT 0;

-- Audit log for session price adjustments
CREATE TABLE "SessionPriceAdjustment" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "appointmentId" INTEGER NOT NULL,
  "oldFinalPrice" REAL NOT NULL,
  "newFinalPrice" REAL NOT NULL,
  "delta" REAL NOT NULL,
  "reason" TEXT NOT NULL,
  "changedByUserId" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionPriceAdjustment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionPriceAdjustment_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
