/*
  Warnings:

  - A unique constraint covering the columns `[appointmentId]` on the table `CoachEarning` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CoachEarning_appointmentId_key" ON "CoachEarning"("appointmentId");
