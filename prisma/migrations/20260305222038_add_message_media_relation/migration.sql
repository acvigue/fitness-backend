-- CreateTable
CREATE TABLE "_MessageMedia" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MessageMedia_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_MessageMedia_B_index" ON "_MessageMedia"("B");

-- AddForeignKey
ALTER TABLE "_MessageMedia" ADD CONSTRAINT "_MessageMedia_A_fkey" FOREIGN KEY ("A") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageMedia" ADD CONSTRAINT "_MessageMedia_B_fkey" FOREIGN KEY ("B") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
