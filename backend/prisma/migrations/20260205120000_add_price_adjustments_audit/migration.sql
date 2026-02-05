-- Add settlement flag and amounts if not existing
ALTER TABLE "Appointment" ADD COLUMN "isSettled" BOOLEAN NOT NULL DEFAULT false;

-- Audit log for session price adjustments
CREATE TABLE "SessionPriceAdjustment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "appointmentId" INTEGER NOT NULL,
  "oldFinalPrice" REAL,
  "newFinalPrice" REAL NOT NULL,
  "oldEffectivePrice" REAL,
  "newEffectivePrice" REAL,
  "reason" TEXT NOT NULL,
  "paymentStatusBefore" TEXT,
  "paymentStatusAfter" TEXT,
  "dueBefore" REAL,
  "dueAfter" REAL,
  "overpaidBefore" REAL,
  "overpaidAfter" REAL,
  "changedByUserId" INTEGER,
  "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionPriceAdjustment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionPriceAdjustment_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
