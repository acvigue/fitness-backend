
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EngagementType" ADD VALUE 'TEAM_CHAT_MESSAGE';
ALTER TYPE "EngagementType" ADD VALUE 'MEETUP_ATTENDED';
ALTER TYPE "EngagementType" ADD VALUE 'INTER_TEAM_INTERACTION';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "message_id" TEXT;

-- CreateIndex
CREATE INDEX "Report_message_id_idx" ON "Report"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "Report_userId1_message_id_key" ON "Report"("userId1", "message_id");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

