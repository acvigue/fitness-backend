/*
  Warnings:

  - A unique constraint covering the columns `[mux_upload_id]` on the table `Video` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[mux_asset_id]` on the table `Video` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[mux_playback_id]` on the table `Video` will be added. If there are existing duplicate values, this will fail.
  - All existing Video rows are deleted as part of the Mux migration. Cascades to TournamentRecap and VideoProgress.

*/
-- Drop pre-Mux video rows. Existing R2 URLs are not migrated.
-- Cascades clean up TournamentRecap and VideoProgress automatically.
DELETE FROM "Video";

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERRORED');

-- AlterTable: add Mux fields, drop pre-Mux URL fields entirely.
ALTER TABLE "Video"
  ADD COLUMN "aspect_ratio"    TEXT,
  ADD COLUMN "duration_sec"    DOUBLE PRECISION,
  ADD COLUMN "mux_asset_id"    TEXT,
  ADD COLUMN "mux_playback_id" TEXT,
  ADD COLUMN "mux_upload_id"   TEXT,
  ADD COLUMN "status"          "VideoStatus" NOT NULL DEFAULT 'PENDING',
  DROP COLUMN "url",
  DROP COLUMN "mime_type",
  DROP COLUMN "size";

-- CreateIndex
CREATE UNIQUE INDEX "Video_mux_upload_id_key" ON "Video"("mux_upload_id");

-- CreateIndex
CREATE UNIQUE INDEX "Video_mux_asset_id_key" ON "Video"("mux_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "Video_mux_playback_id_key" ON "Video"("mux_playback_id");

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "Video"("status");

-- CreateIndex
CREATE INDEX "gym_slots_reserved_by_team_id_idx" ON "gym_slots"("reserved_by_team_id");

-- CreateIndex
CREATE INDEX "gym_slots_updated_by_id_idx" ON "gym_slots"("updated_by_id");

-- AddForeignKey
ALTER TABLE "gym_slots" ADD CONSTRAINT "gym_slots_reserved_by_team_id_fkey" FOREIGN KEY ("reserved_by_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_slots" ADD CONSTRAINT "gym_slots_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_subscriptions" ADD CONSTRAINT "gym_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
