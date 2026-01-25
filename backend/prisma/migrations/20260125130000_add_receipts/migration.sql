-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptNo" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "customerId" INTEGER,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerCode" TEXT,
    "staffId" INTEGER,
    "staffName" TEXT,
    "branchName" TEXT,
    "itemsJson" TEXT NOT NULL,
    "totalsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNo_key" ON "Receipt"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_transactionId_key" ON "Receipt"("transactionId");

-- CreateIndex
CREATE INDEX "Receipt_transactionType_createdAt_idx" ON "Receipt"("transactionType", "createdAt");

-- CreateIndex
CREATE INDEX "Receipt_customerName_customerPhone_idx" ON "Receipt"("customerName", "customerPhone");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptCounter_date_key" ON "ReceiptCounter"("date");
