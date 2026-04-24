
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

-- CreateTable
CREATE TABLE "reminder_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tournament_id" TEXT,
    "intervals_minutes" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_dispatches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "interval_minutes" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_receipts" (
    "id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "broadcast_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_preferences_tournament_id_idx" ON "reminder_preferences"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_preferences_user_id_tournament_id_key" ON "reminder_preferences"("user_id", "tournament_id");

-- CreateIndex
CREATE INDEX "reminder_dispatches_tournament_id_idx" ON "reminder_dispatches"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_dispatches_user_id_tournament_id_interval_minutes_key" ON "reminder_dispatches"("user_id", "tournament_id", "interval_minutes");

-- CreateIndex
CREATE INDEX "broadcasts_team_id_idx" ON "broadcasts"("team_id");

-- CreateIndex
CREATE INDEX "broadcast_receipts_user_id_idx" ON "broadcast_receipts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_receipts_broadcast_id_user_id_key" ON "broadcast_receipts"("broadcast_id", "user_id");

-- CreateIndex
CREATE INDEX "Report_message_id_idx" ON "Report"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "Report_userId1_message_id_key" ON "Report"("userId1", "message_id");

-- AddForeignKey
ALTER TABLE "reminder_preferences" ADD CONSTRAINT "reminder_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_preferences" ADD CONSTRAINT "reminder_preferences_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_receipts" ADD CONSTRAINT "broadcast_receipts_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

