-- Tentative booking schema refactor
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Remove lead-based ownership dependency
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_member_or_lead_xor";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_leadId_fkey";
ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "leadId";

-- Indexes for auto no-show sweep
CREATE INDEX IF NOT EXISTS "Appointment_bookingType_idx" ON "Appointment"("bookingType");
CREATE INDEX IF NOT EXISTS "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX IF NOT EXISTS "Appointment_start_idx" ON "Appointment"("start");
