-- CreateEnum
CREATE TYPE "GymSlotStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'CLOSED');

-- CreateTable
CREATE TABLE "gym_slots" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "GymSlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "reserved_by_team_id" TEXT,
    "note" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gym_slots_gym_id_starts_at_idx" ON "gym_slots"("gym_id", "starts_at");

-- CreateIndex
CREATE INDEX "gym_slots_status_idx" ON "gym_slots"("status");

-- CreateIndex
CREATE INDEX "gym_subscriptions_gym_id_idx" ON "gym_subscriptions"("gym_id");

-- CreateIndex
CREATE UNIQUE INDEX "gym_subscriptions_user_id_gym_id_key" ON "gym_subscriptions"("user_id", "gym_id");

-- AddForeignKey
ALTER TABLE "gym_slots" ADD CONSTRAINT "gym_slots_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_subscriptions" ADD CONSTRAINT "gym_subscriptions_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
