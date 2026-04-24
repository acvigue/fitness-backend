-- CreateEnum
CREATE TYPE "SuspensionAppealStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "RestrictionAction" AS ENUM ('MESSAGING', 'TEAM_JOIN', 'TOURNAMENT_REGISTER');

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

-- AddForeignKey
ALTER TABLE "user_suspensions" ADD CONSTRAINT "user_suspensions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bans" ADD CONSTRAINT "user_bans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspension_appeals" ADD CONSTRAINT "suspension_appeals_suspension_id_fkey" FOREIGN KEY ("suspension_id") REFERENCES "user_suspensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
