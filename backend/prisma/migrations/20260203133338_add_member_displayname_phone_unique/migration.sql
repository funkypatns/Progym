-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "memberId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT,
    "displayName" TEXT NOT NULL,
    "displayNameNorm" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "phoneNorm" TEXT NOT NULL,
    "address" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "photo" TEXT,
    "qrCode" TEXT,
    "faceEncoding" BLOB,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "lastRenewalDate" DATETIME,
    "joinDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Member" (
    "id",
    "memberId",
    "firstName",
    "lastName",
    "fullName",
    "displayName",
    "displayNameNorm",
    "email",
    "phone",
    "phoneNorm",
    "address",
    "dateOfBirth",
    "gender",
    "photo",
    "qrCode",
    "faceEncoding",
    "emergencyContactName",
    "emergencyContactPhone",
    "isActive",
    "notes",
    "lastRenewalDate",
    "joinDate",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "memberId",
    "firstName",
    "lastName",
    TRIM("firstName" || ' ' || "lastName") AS "fullName",
    TRIM("firstName" || ' ' || "lastName") AS "displayName",
    lower(trim(replace(replace("firstName" || ' ' || "lastName", '  ', ' '), '  ', ' '))) AS "displayNameNorm",
    "email",
    "phone",
    replace(replace(replace(replace(replace("phone", ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') AS "phoneNorm",
    "address",
    "dateOfBirth",
    "gender",
    "photo",
    "qrCode",
    "faceEncoding",
    "emergencyContactName",
    "emergencyContactPhone",
    "isActive",
    "notes",
    "lastRenewalDate",
    "joinDate",
    "createdAt",
    "updatedAt"
FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_memberId_key" ON "Member"("memberId");
CREATE UNIQUE INDEX "Member_displayNameNorm_key" ON "Member"("displayNameNorm");
CREATE UNIQUE INDEX "Member_phoneNorm_key" ON "Member"("phoneNorm");
CREATE INDEX "Member_gender_idx" ON "Member"("gender");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
