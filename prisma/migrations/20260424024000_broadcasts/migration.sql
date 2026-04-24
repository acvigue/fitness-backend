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
CREATE INDEX "broadcasts_team_id_idx" ON "broadcasts"("team_id");

-- CreateIndex
CREATE INDEX "broadcast_receipts_user_id_idx" ON "broadcast_receipts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_receipts_broadcast_id_user_id_key" ON "broadcast_receipts"("broadcast_id", "user_id");

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_receipts" ADD CONSTRAINT "broadcast_receipts_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
