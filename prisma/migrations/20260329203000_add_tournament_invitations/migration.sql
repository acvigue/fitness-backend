-- CreateEnum
CREATE TYPE "TournamentInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "tournament_invitations" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "status" "TournamentInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_invitations_team_id_idx" ON "tournament_invitations"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_invitations_tournament_id_team_id_status_key" ON "tournament_invitations"("tournament_id", "team_id", "status");

-- AddForeignKey
ALTER TABLE "tournament_invitations" ADD CONSTRAINT "tournament_invitations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_invitations" ADD CONSTRAINT "tournament_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
