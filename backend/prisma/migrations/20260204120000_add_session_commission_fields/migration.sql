-- Add session commission fields to Payment
ALTER TABLE "Payment" ADD COLUMN "sessionPrice" REAL;
ALTER TABLE "Payment" ADD COLUMN "commissionPercentUsed" REAL;
ALTER TABLE "Payment" ADD COLUMN "trainerPayout" REAL;
ALTER TABLE "Payment" ADD COLUMN "gymShare" REAL;
