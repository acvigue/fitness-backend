-- CreateTable
CREATE TABLE "_TournamentHistory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TournamentHistory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TournamentHistory_B_index" ON "_TournamentHistory"("B");

-- AddForeignKey
ALTER TABLE "_TournamentHistory" ADD CONSTRAINT "_TournamentHistory_A_fkey" FOREIGN KEY ("A") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TournamentHistory" ADD CONSTRAINT "_TournamentHistory_B_fkey" FOREIGN KEY ("B") REFERENCES "user_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
