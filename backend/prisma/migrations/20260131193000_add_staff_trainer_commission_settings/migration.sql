-- AlterTable
ALTER TABLE "StaffTrainer" ADD COLUMN "commissionType" TEXT NOT NULL DEFAULT 'percentage';
ALTER TABLE "StaffTrainer" ADD COLUMN "commissionValue" REAL;
ALTER TABLE "StaffTrainer" ADD COLUMN "internalSessionValue" REAL NOT NULL DEFAULT 0;

-- Sync existing percent values into commissionValue
UPDATE "StaffTrainer" SET commissionValue = commissionPercent WHERE commissionValue IS NULL AND commissionPercent IS NOT NULL;
