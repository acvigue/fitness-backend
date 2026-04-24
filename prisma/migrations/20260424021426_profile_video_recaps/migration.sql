-- CreateTable
CREATE TABLE "video_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "position_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_recaps" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_recaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_progress_user_id_idx" ON "video_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_progress_user_id_video_id_key" ON "video_progress"("user_id", "video_id");

-- CreateIndex
CREATE INDEX "tournament_recaps_tournament_id_idx" ON "tournament_recaps"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_recaps_tournament_id_video_id_key" ON "tournament_recaps"("tournament_id", "video_id");

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_recaps" ADD CONSTRAINT "tournament_recaps_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_recaps" ADD CONSTRAINT "tournament_recaps_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
