-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'COMPLETED', 'BYE');

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "match_number" INTEGER NOT NULL,
    "team1_id" TEXT,
    "team2_id" TEXT,
    "team1_score" INTEGER,
    "team2_score" INTEGER,
    "winner_id" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "next_match_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournament_matches_tournament_id_idx" ON "tournament_matches"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_matches_tournament_id_round_match_number_key" ON "tournament_matches"("tournament_id", "round", "match_number");

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_team1_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_next_match_id_fkey" FOREIGN KEY ("next_match_id") REFERENCES "tournament_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
