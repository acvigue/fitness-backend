
-- CreateEnum
CREATE TYPE "SuspensionAppealStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "RestrictionAction" AS ENUM ('MESSAGING', 'TEAM_JOIN', 'TOURNAMENT_REGISTER');

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

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "deletion_reason" TEXT,
ADD COLUMN     "hidden_at" TIMESTAMP(3),
ADD COLUMN     "hidden_by_id" TEXT;

-- CreateTable
CREATE TABLE "user_suspensions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "issued_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_bans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "issued_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspension_appeals" (
    "id" TEXT NOT NULL,
    "suspension_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SuspensionAppealStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suspension_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_restrictions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "issued_by_id" TEXT NOT NULL,
    "action" "RestrictionAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_restrictions_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "user_suspensions_user_id_revoked_at_idx" ON "user_suspensions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_suspensions_ends_at_idx" ON "user_suspensions"("ends_at");

-- CreateIndex
CREATE INDEX "user_bans_user_id_revoked_at_idx" ON "user_bans"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "suspension_appeals_suspension_id_idx" ON "suspension_appeals"("suspension_id");

-- CreateIndex
CREATE INDEX "user_restrictions_user_id_action_revoked_at_idx" ON "user_restrictions"("user_id", "action", "revoked_at");

-- CreateIndex
CREATE INDEX "user_restrictions_ends_at_idx" ON "user_restrictions"("ends_at");

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
ALTER TABLE "user_suspensions" ADD CONSTRAINT "user_suspensions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspension_appeals" ADD CONSTRAINT "suspension_appeals_suspension_id_fkey" FOREIGN KEY ("suspension_id") REFERENCES "user_suspensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

