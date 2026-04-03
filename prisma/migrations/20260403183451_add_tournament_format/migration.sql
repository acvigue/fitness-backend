-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'ROUND_ROBIN');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "format" "TournamentFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION';
