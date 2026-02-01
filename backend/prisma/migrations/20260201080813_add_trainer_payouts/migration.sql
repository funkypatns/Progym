-- CreateTable
CREATE TABLE "TrainerPayout" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trainerId" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidByEmployeeId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainerPayout_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "StaffTrainer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainerPayout_paidByEmployeeId_fkey" FOREIGN KEY ("paidByEmployeeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainerEarning" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trainerId" INTEGER NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "baseAmount" REAL NOT NULL DEFAULT 0,
    "commissionPercent" REAL,
    "commissionAmount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "payoutId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainerEarning_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "StaffTrainer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainerEarning_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainerEarning_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "TrainerPayout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrainerPayout_trainerId_idx" ON "TrainerPayout"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerEarning_appointmentId_key" ON "TrainerEarning"("appointmentId");

-- CreateIndex
CREATE INDEX "TrainerEarning_trainerId_status_idx" ON "TrainerEarning"("trainerId", "status");

