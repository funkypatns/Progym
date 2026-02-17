-- Leads table for tentative/visitor bookings
CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "convertedMemberId" INTEGER,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- Appointment updates
ALTER TABLE "Appointment" ADD COLUMN "leadId" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN "bookingType" TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE "Appointment" ADD COLUMN "sessionName" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "sessionPrice" DOUBLE PRECISION;
ALTER TABLE "Appointment" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'booked';

-- Payment updates (lead completion can create payment before member conversion)
ALTER TABLE "Payment" ALTER COLUMN "memberId" DROP NOT NULL;

-- Indexes
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- Foreign keys
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedMemberId_fkey"
    FOREIGN KEY ("convertedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_memberId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce exactly one booking owner: member OR lead
ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_member_or_lead_xor"
    CHECK (("memberId" IS NOT NULL AND "leadId" IS NULL) OR ("memberId" IS NULL AND "leadId" IS NOT NULL));
