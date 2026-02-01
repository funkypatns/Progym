-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "isCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing completed statuses
UPDATE "Appointment" SET "isCompleted" = true WHERE "status" IN ('completed', 'auto_completed');
