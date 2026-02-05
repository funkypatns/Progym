-- CreateTable
CREATE TABLE "MemberCreditLedger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" INTEGER NOT NULL,
    "sourceAppointmentId" INTEGER,
    "appliedAppointmentId" INTEGER,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberCreditLedger_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberCreditLedger_sourceAppointmentId_fkey" FOREIGN KEY ("sourceAppointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemberCreditLedger_appliedAppointmentId_fkey" FOREIGN KEY ("appliedAppointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemberCreditLedger_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MemberCreditLedger_memberId_idx" ON "MemberCreditLedger"("memberId");

-- CreateIndex
CREATE INDEX "MemberCreditLedger_sourceAppointmentId_idx" ON "MemberCreditLedger"("sourceAppointmentId");

-- CreateIndex
CREATE INDEX "MemberCreditLedger_appliedAppointmentId_idx" ON "MemberCreditLedger"("appliedAppointmentId");
