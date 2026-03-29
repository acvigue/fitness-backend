-- CreateTable
CREATE TABLE "_FeaturedAchievements" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_FeaturedAchievements_A_fkey" FOREIGN KEY ("A") REFERENCES "user_achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_FeaturedAchievements_B_fkey" FOREIGN KEY ("B") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_FeaturedAchievements_AB_unique" ON "_FeaturedAchievements"("A", "B");

-- CreateIndex
CREATE INDEX "_FeaturedAchievements_B_index" ON "_FeaturedAchievements"("B");
