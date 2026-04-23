-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "privateAchievements" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privateBio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privateSports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privateTournaments" BOOLEAN NOT NULL DEFAULT false;
