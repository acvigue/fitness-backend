-- AlterTable
ALTER TABLE "_FeaturedAchievements" ADD CONSTRAINT "_FeaturedAchievements_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_FeaturedAchievements_AB_unique";

-- AlterTable
ALTER TABLE "_TournamentTeams" ADD CONSTRAINT "_TournamentTeams_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_TournamentTeams_AB_unique";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT;
