-- Extend audit log for session price adjustments
ALTER TABLE "SessionPriceAdjustment" ADD COLUMN "oldEffectivePrice" REAL;
ALTER TABLE "SessionPriceAdjustment" ADD COLUMN "newEffectivePrice" REAL;
ALTER TABLE "SessionPriceAdjustment" ADD COLUMN "paymentStatusBefore" TEXT;
ALTER TABLE "SessionPriceAdjustment" ADD COLUMN "paymentStatusAfter" TEXT;
ALTER TABLE "SessionPriceAdjustment" ADD COLUMN "dueBefore" REAL;
ALTER TABLE "SessionPriceAdjustment" ADD COLUMN "dueAfter" REAL;
ALTER TABLE "SessionPriceAdjustment" ADD COLUMN "overpaidBefore" REAL;
ALTER TABLE "SessionPriceAdjustment" ADD COLUMN "overpaidAfter" REAL;
