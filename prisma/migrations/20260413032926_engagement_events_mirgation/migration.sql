/*
  Warnings:

  - You are about to drop the column `write_roles` on the `chats` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('MESSAGE_SENT', 'PROFILE_VIEW', 'TEAM_JOIN', 'TEAM_LEAVE', 'CHAT_CREATED', 'TOURNAMENT_JOIN');

-- AlterTable
ALTER TABLE "chats" DROP COLUMN "write_roles",
ADD COLUMN     "writeRoles" "OrganizationRole"[] DEFAULT ARRAY[]::"OrganizationRole"[];

-- CreateTable
CREATE TABLE "engagement_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "EngagementType" NOT NULL,
    "target_user_id" TEXT,
    "team_id" TEXT,
    "chat_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engagement_events_user_id_idx" ON "engagement_events"("user_id");

-- CreateIndex
CREATE INDEX "engagement_events_type_idx" ON "engagement_events"("type");

-- CreateIndex
CREATE INDEX "engagement_events_created_at_idx" ON "engagement_events"("created_at");

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
