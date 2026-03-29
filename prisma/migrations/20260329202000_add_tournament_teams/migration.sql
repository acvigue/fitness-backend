-- CreateTable
CREATE TABLE "_TournamentTeams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TournamentTeams_A_fkey" FOREIGN KEY ("A") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TournamentTeams_B_fkey" FOREIGN KEY ("B") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_TournamentTeams_AB_unique" ON "_TournamentTeams"("A", "B");

-- CreateIndex
CREATE INDEX "_TournamentTeams_B_index" ON "_TournamentTeams"("B");
