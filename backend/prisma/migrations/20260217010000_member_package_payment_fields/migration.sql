ALTER TABLE "MemberPackage" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "MemberPackage" ADD COLUMN "paymentStatus" TEXT DEFAULT 'unpaid';
ALTER TABLE "MemberPackage" ADD COLUMN "amountPaid" REAL DEFAULT 0;
