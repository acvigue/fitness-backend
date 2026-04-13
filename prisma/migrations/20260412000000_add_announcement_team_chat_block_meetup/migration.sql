-- AlterEnum
ALTER TYPE "ChatType" ADD VALUE 'ANNOUNCEMENT';
ALTER TYPE "ChatType" ADD VALUE 'TEAM';

-- CreateEnum
CREATE TYPE "MeetupStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "chats" ADD COLUMN "organization_id" TEXT,
ADD COLUMN "write_roles" "OrganizationRole"[] DEFAULT ARRAY[]::"OrganizationRole"[],
ADD COLUMN "team1_id" TEXT,
ADD COLUMN "team2_id" TEXT;

-- CreateTable
CREATE TABLE "team_blocks" (
    "id" TEXT NOT NULL,
    "blocking_team_id" TEXT NOT NULL,
    "blocked_team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetups" (
    "id" TEXT NOT NULL,
    "proposing_team_id" TEXT NOT NULL,
    "receiving_team_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "date_time" TIMESTAMP(3) NOT NULL,
    "status" "MeetupStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chats_team1_id_team2_id_key" ON "chats"("team1_id", "team2_id");

-- CreateIndex
CREATE INDEX "chats_organization_id_idx" ON "chats"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_blocks_blocking_team_id_blocked_team_id_key" ON "team_blocks"("blocking_team_id", "blocked_team_id");

-- CreateIndex
CREATE INDEX "team_blocks_blocking_team_id_idx" ON "team_blocks"("blocking_team_id");

-- CreateIndex
CREATE INDEX "team_blocks_blocked_team_id_idx" ON "team_blocks"("blocked_team_id");

-- CreateIndex
CREATE INDEX "meetups_proposing_team_id_idx" ON "meetups"("proposing_team_id");

-- CreateIndex
CREATE INDEX "meetups_receiving_team_id_idx" ON "meetups"("receiving_team_id");

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_team1_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_blocks" ADD CONSTRAINT "team_blocks_blocking_team_id_fkey" FOREIGN KEY ("blocking_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_blocks" ADD CONSTRAINT "team_blocks_blocked_team_id_fkey" FOREIGN KEY ("blocked_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetups" ADD CONSTRAINT "meetups_proposing_team_id_fkey" FOREIGN KEY ("proposing_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetups" ADD CONSTRAINT "meetups_receiving_team_id_fkey" FOREIGN KEY ("receiving_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
