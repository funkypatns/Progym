-- POS-style close periods (immutable closed snapshots + one active open period)
CREATE TABLE "CashClosePeriod" (
    "id" SERIAL NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'MANUAL',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "snapshotJson" TEXT,
    "exportVersion" INTEGER NOT NULL DEFAULT 1,
    "expectedCashAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedNonCashAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCardAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedTransferAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedTotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCashAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualNonCashAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualTotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "differenceCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "differenceNonCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "differenceTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sessionsTotal" INTEGER NOT NULL DEFAULT 0,
    "payoutsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashInTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashRefundsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cardRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transferRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" INTEGER,
    "closedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CashClosePeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashClosePeriod_status_startAt_idx" ON "CashClosePeriod"("status", "startAt");
CREATE INDEX "CashClosePeriod_closedAt_idx" ON "CashClosePeriod"("closedAt");

ALTER TABLE "CashClosePeriod" ADD CONSTRAINT "CashClosePeriod_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashClosePeriod" ADD CONSTRAINT "CashClosePeriod_closedBy_fkey"
FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce single OPEN period at DB level (PostgreSQL partial unique index)
CREATE UNIQUE INDEX "CashClosePeriod_single_open_idx"
ON "CashClosePeriod" ("status")
WHERE "status" = 'OPEN';
